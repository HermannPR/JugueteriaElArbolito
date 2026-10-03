"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { PermissionError, requireActionRole, type PanelUser } from "@/lib/auth";
import { ImageError, downloadImage, removeStoredImage, saveProductImage, toWebp } from "@/lib/product-images";
import { ROLE_RANK, type Role } from "@/lib/roles";
import { applyProductFilter, chunk, isReadyToPublish } from "@/lib/catalog-status";

// Toda escritura del panel pasa por aquí: el rol se valida en el servidor y el
// cambio queda en audit_log. El navegador ya no escribe directo en Supabase.

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // el navegador reduce la foto antes de subirla
const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled", "requires_attention"] as const;

class InputError extends Error {}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (err instanceof PermissionError || err instanceof ImageError || err instanceof InputError) {
      return { ok: false, error: err.message };
    }
    console.error("Acción del panel falló:", err);
    return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo; si sigue, avisa a soporte." };
  }
}

function assertId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !UUID_RE.test(id)) throw new InputError("Identificador inválido.");
}

async function audit(actor: PanelUser, action: string, entity: string, entityId: string, details?: Record<string, unknown>) {
  const { error } = await createAdminClient().from("audit_log").insert({
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    entity,
    entity_id: entityId,
    details: details ?? null,
  });
  if (error) console.error("No se pudo escribir audit_log:", error.message);
}

function refreshProduct(productId: string) {
  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${productId}/editar`);
  revalidatePath("/admin");
  revalidatePath(`/producto/${productId}`);
  revalidatePath("/productos");
}

async function loadProduct(productId: string) {
  const { data, error } = await createAdminClient()
    .from("products")
    .select("id, name, price, image_url, category_id, is_active, is_approved, is_blocked")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new InputError("El producto no existe.");
  return data;
}

// --- Datos del producto (empleado) ------------------------------------------------

export async function saveProductDetails(
  productId: string,
  input: { name: string; description: string; category_id: string | null; subcategory_id: string | null }
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("staff");
    assertId(productId);
    const name = String(input.name ?? "").trim();
    if (name.length < 3 || name.length > 160) throw new InputError("El nombre debe tener entre 3 y 160 caracteres.");
    const description = String(input.description ?? "").trim().slice(0, 2000) || null;

    const db = createAdminClient();
    const categoryId = input.category_id || null;
    let subcategoryId = input.subcategory_id || null;
    if (categoryId) assertId(categoryId);
    if (subcategoryId) {
      assertId(subcategoryId);
      const { data: sub } = await db.from("subcategories").select("category_id").eq("id", subcategoryId).maybeSingle();
      if (!sub || sub.category_id !== categoryId) subcategoryId = null; // subcategoría de otra categoría
    }

    const product = await loadProduct(productId);
    if (!categoryId && product.is_approved) {
      throw new InputError("Un producto publicado necesita categoría. Despublícalo primero si quieres quitarla.");
    }

    const { error } = await db
      .from("products")
      .update({ name, description, category_id: categoryId, subcategory_id: subcategoryId })
      .eq("id", productId);
    if (error) throw error;
    await audit(actor, "product.details", "product", productId, { name, category_id: categoryId, subcategory_id: subcategoryId });
    refreshProduct(productId);
  });
}

// --- Fotos (empleado) -----------------------------------------------------------------

export async function uploadProductImage(formData: FormData): Promise<ActionResult<{ image_url: string }>> {
  return run(async () => {
    const actor = await requireActionRole("staff");
    const productId = formData.get("product_id");
    const file = formData.get("file");
    assertId(productId);
    if (!(file instanceof File) || file.size === 0) throw new InputError("Selecciona una imagen.");
    if (file.size > MAX_UPLOAD_BYTES) throw new InputError("La imagen es demasiado pesada. Intenta con otra.");
    await loadProduct(productId);

    const webp = await toWebp(Buffer.from(await file.arrayBuffer()));
    const imageUrl = await saveProductImage(createAdminClient(), productId, webp);
    await audit(actor, "product.image_upload", "product", productId, { bytes: webp.length });
    refreshProduct(productId);
    return { image_url: imageUrl };
  });
}

export async function importProductImageFromUrl(productId: string, url: string): Promise<ActionResult<{ image_url: string }>> {
  return run(async () => {
    const actor = await requireActionRole("staff");
    assertId(productId);
    await loadProduct(productId);

    const webp = await toWebp(await downloadImage(String(url ?? "")));
    const imageUrl = await saveProductImage(createAdminClient(), productId, webp);
    await audit(actor, "product.image_url", "product", productId, { source: String(url).slice(0, 500) });
    refreshProduct(productId);
    return { image_url: imageUrl };
  });
}

export async function removeProductImage(productId: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("staff");
    assertId(productId);
    const product = await loadProduct(productId);
    const db = createAdminClient();
    // Sin foto no puede estar publicado.
    const { error } = await db.from("products").update({ image_url: null, is_approved: false }).eq("id", productId);
    if (error) throw error;
    await removeStoredImage(db, product.image_url);
    await audit(actor, "product.image_remove", "product", productId, { was_published: product.is_approved });
    refreshProduct(productId);
  });
}

// --- Publicación (empleado) -------------------------------------------------------------

/** Qué le falta a un producto para poder publicarse (vacío = listo). */
function missingForPublish(p: { name: string; price: number; image_url: string | null; category_id: string | null; is_active: boolean; is_blocked: boolean }): string[] {
  const missing: string[] = [];
  if (p.is_blocked) missing.push("está bloqueado por administración");
  if (!p.is_active) missing.push("ya no existe en Eleventa");
  if (!p.image_url) missing.push("foto");
  if (!p.category_id) missing.push("categoría");
  if (!(Number(p.price) > 0)) missing.push("precio mayor a $0");
  return missing;
}

export async function publishProduct(productId: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("staff");
    assertId(productId);
    const product = await loadProduct(productId);
    const missing = missingForPublish(product);
    if (missing.length) throw new InputError(`No se puede publicar: falta ${missing.join(", ")}.`);

    const { error } = await createAdminClient()
      .from("products")
      .update({ is_approved: true, approved_at: new Date().toISOString(), approved_by: actor.id })
      .eq("id", productId);
    if (error) throw error;
    await audit(actor, "product.publish", "product", productId);
    refreshProduct(productId);
  });
}

export async function unpublishProduct(productId: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("staff");
    assertId(productId);
    const { error } = await createAdminClient().from("products").update({ is_approved: false }).eq("id", productId);
    if (error) throw error;
    await audit(actor, "product.unpublish", "product", productId);
    refreshProduct(productId);
  });
}

const BULK_PAGE = 1000; // máximo de filas que PostgREST devuelve por consulta
const BULK_CHUNK = 200;

/**
 * Publica de una vez todos los "Listos para publicar" (opcionalmente de una
 * categoría). Solo administración: es un cambio grande en la tienda. Los ids
 * quedan en audit_log para poder revertir.
 */
export async function publishAllReady(categoryId: string | null): Promise<ActionResult<{ published: number }>> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    if (categoryId) assertId(categoryId);
    const db = createAdminClient();

    const ids: string[] = [];
    for (let from = 0; ; from += BULK_PAGE) {
      let query = applyProductFilter(
        db.from("products").select("id, price, image_url, category_id, is_active, is_approved, is_blocked"),
        "listos"
      );
      if (categoryId) query = query.eq("category_id", categoryId);
      const { data, error } = await query.order("id").range(from, from + BULK_PAGE - 1);
      if (error) throw error;
      for (const p of data ?? []) if (isReadyToPublish(p)) ids.push(p.id);
      if (!data || data.length < BULK_PAGE) break;
    }
    if (!ids.length) throw new InputError("No hay productos listos para publicar.");

    const now = new Date().toISOString();
    let published = 0;
    for (const part of chunk(ids, BULK_CHUNK)) {
      // Se repiten las condiciones por si algo cambió entre la consulta y el update.
      const { data, error } = await db
        .from("products")
        .update({ is_approved: true, approved_at: now, approved_by: actor.id })
        .in("id", part)
        .eq("is_approved", false)
        .eq("is_blocked", false)
        .eq("is_active", true)
        .select("id");
      if (error) throw error;
      published += data?.length ?? 0;
    }

    await audit(actor, "product.publish_bulk", "product", categoryId ?? "todas", { published, ids });
    revalidatePath("/", "layout"); // catálogo, categorías, fichas y panel
    return { published };
  });
}

// --- Administración: precio, bloqueo, stock -----------------------------------------------

export async function savePricing(
  productId: string,
  input: { price_overridden: boolean; price: number; old_price: number | null; is_featured: boolean }
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    assertId(productId);
    const update: Record<string, unknown> = { price_overridden: input.price_overridden === true, is_featured: input.is_featured === true };
    if (input.price_overridden) {
      const price = Number(input.price);
      const oldPrice = input.old_price === null || input.old_price === undefined ? null : Number(input.old_price);
      if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) throw new InputError("Precio inválido.");
      if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice <= price)) {
        throw new InputError("El precio anterior (tachado) debe ser mayor que el precio actual.");
      }
      update.price = Math.round(price * 100) / 100;
      update.old_price = oldPrice === null ? null : Math.round(oldPrice * 100) / 100;
    }
    const { error } = await createAdminClient().from("products").update(update).eq("id", productId);
    if (error) throw error;
    await audit(actor, "product.pricing", "product", productId, update);
    refreshProduct(productId);
  });
}

export async function setProductBlocked(productId: string, blocked: boolean, reason: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    assertId(productId);
    const cleanReason = String(reason ?? "").trim().slice(0, 300);
    if (blocked && cleanReason.length < 3) throw new InputError("Escribe el motivo del bloqueo.");
    const update = blocked
      ? { is_blocked: true, is_approved: false, blocked_reason: cleanReason }
      : { is_blocked: false, blocked_reason: null };
    const { error } = await createAdminClient().from("products").update(update).eq("id", productId);
    if (error) throw error;
    await audit(actor, blocked ? "product.block" : "product.unblock", "product", productId, blocked ? { reason: cleanReason } : undefined);
    refreshProduct(productId);
  });
}

export async function adjustStock(productId: string, delta: number, note: string): Promise<ActionResult<{ stock: number }>> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    assertId(productId);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10_000) throw new InputError("Cantidad inválida.");
    const cleanNote = String(note ?? "").trim().slice(0, 300);
    if (cleanNote.length < 3) throw new InputError("Escribe el motivo del ajuste (p. ej. \"conteo físico\").");

    const { data, error } = await createAdminClient().rpc("apply_stock_movement", {
      p_product_id: productId,
      p_delta: delta,
      p_reason: delta > 0 ? "restock" : "manual_adjustment",
      p_order_id: null,
      p_idempotency_key: `manual:${randomUUID()}`,
      p_notes: `${cleanNote} — ${actor.email}`,
    });
    if (error) throw error;
    if (data?.status === "insufficient_stock") throw new InputError(`No puedes quitar más de lo que hay (${data.available}).`);
    if (data?.status !== "ok") throw new InputError("No se pudo ajustar el stock.");
    await audit(actor, "product.stock_adjust", "product", productId, { delta, note: cleanNote, stock_after: data.stock_after });
    refreshProduct(productId);
    return { stock: data.stock_after as number };
  });
}

export async function setStockBuffer(productId: string, buffer: number): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    assertId(productId);
    if (!Number.isInteger(buffer) || buffer < 0 || buffer > 1000) throw new InputError("Reserva inválida.");
    const { error } = await createAdminClient().from("products").update({ stock_buffer: buffer }).eq("id", productId);
    if (error) throw error;
    await audit(actor, "product.stock_buffer", "product", productId, { stock_buffer: buffer });
    refreshProduct(productId);
  });
}

// --- Pedidos (administración) ------------------------------------------------------------------

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    assertId(orderId);
    if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) throw new InputError("Estado inválido.");
    const { error } = await createAdminClient().from("orders").update({ order_status: status }).eq("id", orderId);
    if (error) throw error;
    await audit(actor, "order.status", "order", orderId, { status });
    revalidatePath("/admin/pedidos");
  });
}

export async function setOrderRegisteredInEleventa(orderId: string, registered: boolean): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    assertId(orderId);
    const { data: order } = await createAdminClient().from("orders").select("payment_status").eq("id", orderId).maybeSingle();
    if (!order) throw new InputError("El pedido no existe.");
    if (order.payment_status !== "paid") throw new InputError("Solo los pedidos pagados se capturan en Eleventa.");
    const { error } = await createAdminClient()
      .from("orders")
      .update(registered ? { pos_registered_at: new Date().toISOString(), pos_registered_by: actor.id } : { pos_registered_at: null, pos_registered_by: null })
      .eq("id", orderId);
    if (error) throw error;
    await audit(actor, registered ? "order.pos_registered" : "order.pos_unregistered", "order", orderId);
    revalidatePath("/admin/pedidos");
  });
}

// --- Usuarios del panel ---------------------------------------------------------------------------
// Administración da de alta empleados; solo superadmin asigna administrador/superadmin.

function assertCanAssign(actor: PanelUser, role: Role) {
  if (!(role in ROLE_RANK)) throw new InputError("Rol inválido.");
  if (actor.role !== "superadmin" && ROLE_RANK[role] > ROLE_RANK.staff) {
    throw new PermissionError("Solo soporte técnico puede asignar ese rol.");
  }
}

export async function createPanelUser(input: { email: string; password: string; full_name: string; role: Role }): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    assertCanAssign(actor, input.role);
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError("Correo inválido.");
    if (String(input.password ?? "").length < 10) throw new InputError("La contraseña debe tener al menos 10 caracteres.");

    const db = createAdminClient();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: String(input.full_name ?? "").trim().slice(0, 120) },
    });
    if (error) throw new InputError(error.message.includes("already") ? "Ya existe una cuenta con ese correo." : error.message);
    // El trigger handle_new_user crea el perfil; aquí solo se asigna el rol.
    const { error: roleErr } = await db.from("user_profiles").update({ role: input.role }).eq("user_id", data.user.id);
    if (roleErr) throw roleErr;
    await audit(actor, "user.create", "user", data.user.id, { email, role: input.role });
    revalidatePath("/admin/usuarios");
  });
}

export async function setUserRole(userId: string, role: Role): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActionRole("admin");
    assertId(userId);
    if (userId === actor.id) throw new InputError("No puedes cambiar tu propio rol.");
    assertCanAssign(actor, role);

    const db = createAdminClient();
    const { data: target } = await db.from("user_profiles").select("role").eq("user_id", userId).maybeSingle();
    if (!target) throw new InputError("El usuario no existe.");
    if (actor.role !== "superadmin" && ROLE_RANK[target.role as Role] > ROLE_RANK.staff) {
      throw new PermissionError("Solo soporte técnico puede cambiar a un administrador.");
    }
    const { error } = await db.from("user_profiles").update({ role }).eq("user_id", userId);
    if (error) throw error;
    await audit(actor, "user.role", "user", userId, { from: target.role, to: role });
    revalidatePath("/admin/usuarios");
  });
}
