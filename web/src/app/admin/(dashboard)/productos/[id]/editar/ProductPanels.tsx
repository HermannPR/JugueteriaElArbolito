"use client";

import { useRef, useState, useTransition } from "react";
import { Ban, Check, ImageOff, Link as LinkIcon, Minus, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adjustStock,
  importProductImageFromUrl,
  publishProduct,
  removeProductImage,
  saveProductDetails,
  savePricing,
  setProductBlocked,
  setStockBuffer,
  unpublishProduct,
  uploadProductImage,
  type ActionResult,
} from "@/app/admin/actions";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  old_price: number | null;
  stock: number;
  stock_buffer: number;
  image_url: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  is_active: boolean;
  is_approved: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  is_featured: boolean;
  price_overridden: boolean;
  last_synced_at: string | null;
}

const panel = "bg-white rounded-2xl border border-border shadow-sm p-5 space-y-4";
const field = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-ring";

/** Ejecuta una server action y expone estado de carga, error y aviso de éxito. */
function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  function run<T>(fn: () => Promise<ActionResult<T>>, okMessage = "", onOk?: (data?: T) => void) {
    setError("");
    setDone("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setDone(okMessage);
        onOk?.(res.data);
      } else {
        setError(res.error);
      }
    });
  }
  return { pending, error, done, run };
}

function Feedback({ error, done }: { error: string; done: string }) {
  if (error) return <p className="text-sm text-destructive" role="alert">{error}</p>;
  if (done) return <p className="text-sm text-green-700" role="status">{done}</p>;
  return null;
}

/** Reduce la foto en el navegador (≤1600 px, JPEG) para no chocar con el límite de subida. */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // PNG transparentes quedan sobre blanco
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (blob) return blob;
  } catch {
    // El navegador no pudo leerla (p. ej. HEIC fuera de Safari): se intenta con el original.
  }
  return file;
}

// --- Foto ----------------------------------------------------------------------

export function ImagePanel({ productId, imageUrl }: { productId: string; imageUrl: string | null }) {
  const [url, setUrl] = useState(imageUrl);
  const [source, setSource] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { pending, error, done, run } = useAction();

  function onFile(file: File | undefined) {
    if (!file) return;
    run(async () => {
      const blob = await shrinkImage(file);
      if (blob.size > 4 * 1024 * 1024) return { ok: false as const, error: "No se pudo reducir la foto. Prueba con JPG o PNG." };
      const form = new FormData();
      form.set("product_id", productId);
      form.set("file", blob, "foto.jpg");
      return uploadProductImage(form);
    }, "Foto guardada.", (data) => data && setUrl(data.image_url));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className={panel}>
      <h2 className="font-display font-semibold">Foto</h2>
      <div className="aspect-square rounded-xl border border-border bg-surface overflow-hidden flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Foto del producto" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-muted-foreground text-sm">
            <ImageOff className="w-8 h-8 mx-auto mb-2" />
            Sin foto
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="flex gap-2">
        <Button type="button" className="flex-1 gap-1.5" disabled={pending} onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" /> {pending ? "Procesando…" : url ? "Cambiar foto" : "Subir foto"}
        </Button>
        {url && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            aria-label="Quitar foto"
            onClick={() => {
              if (confirm("¿Quitar la foto? Si el producto está publicado, se despublicará.")) {
                run(() => removeProductImage(productId), "Foto quitada.", () => setUrl(null));
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (source.trim()) run(() => importProductImageFromUrl(productId, source), "Foto importada.", (data) => { if (data) setUrl(data.image_url); setSource(""); });
        }}
      >
        <label className="text-xs font-medium text-muted-foreground" htmlFor="img-url">O pega la dirección de una imagen</label>
        <div className="flex gap-2">
          <Input id="img-url" type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://…/foto.jpg" className="text-sm" />
          <Button type="submit" variant="outline" disabled={pending || !source.trim()} className="gap-1.5 shrink-0">
            <LinkIcon className="w-4 h-4" /> Importar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">En Google Imágenes: abre la imagen → clic derecho → “Copiar dirección de la imagen”.</p>
      </form>
      <Feedback error={error} done={done} />
    </section>
  );
}

// --- Datos -----------------------------------------------------------------------

export function DetailsForm({
  product,
  categories,
  subcategories,
}: {
  product: Product;
  categories: Array<{ id: string; name: string; emoji: string }>;
  subcategories: Array<{ id: string; name: string; category_id: string }>;
}) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    category_id: product.category_id ?? "",
    subcategory_id: product.subcategory_id ?? "",
  });
  const { pending, error, done, run } = useAction();
  const subs = subcategories.filter((s) => s.category_id === form.category_id);

  return (
    <form
      className={panel}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => saveProductDetails(product.id, { ...form, category_id: form.category_id || null, subcategory_id: form.subcategory_id || null }),
          "Cambios guardados."
        );
      }}
    >
      <h2 className="font-display font-semibold">Datos para la tienda en línea</h2>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="name">Nombre</label>
        <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={3} maxLength={160} />
        <p className="text-xs text-muted-foreground">Viene de Eleventa en mayúsculas; puedes escribirlo más claro para el cliente.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="cat">Categoría</label>
          <select id="cat" className={field} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value, subcategory_id: "" })}>
            <option value="">Elegir…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="sub">Subcategoría</label>
          <select id="sub" className={field} value={form.subcategory_id} disabled={subs.length === 0} onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })}>
            <option value="">{subs.length ? "Opcional…" : "No aplica"}</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="desc">Descripción <span className="text-muted-foreground font-normal">(opcional)</span></label>
        <textarea
          id="desc"
          rows={4}
          maxLength={2000}
          className={`${field} resize-y`}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Edad recomendada, material, qué incluye…"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar datos"}</Button>
        <Feedback error={error} done={done} />
      </div>
    </form>
  );
}

// --- Publicación ------------------------------------------------------------------

export function PublishPanel({ product }: { product: Product }) {
  const { pending, error, done, run } = useAction();
  const checks = [
    { ok: Boolean(product.image_url), label: "Tiene foto" },
    { ok: Boolean(product.category_id), label: "Tiene categoría" },
    { ok: Number(product.price) > 0, label: "Tiene precio" },
    { ok: product.is_active, label: "Existe en Eleventa" },
    { ok: !product.is_blocked, label: "No está bloqueado" },
  ];
  const ready = checks.every((c) => c.ok);

  return (
    <section className={panel}>
      <h2 className="font-display font-semibold">Venta en línea</h2>
      {product.is_approved ? (
        <p className="text-sm">
          <span className="font-medium text-green-700">Publicado.</span>{" "}
          {product.stock > 0 ? "Se muestra en la tienda." : "Está agotado: reaparecerá en la tienda cuando haya stock."}
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 ${c.ok ? "text-foreground" : "text-muted-foreground"}`}>
              {c.ok ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-destructive" />}
              {c.label}
            </li>
          ))}
        </ul>
      )}
      {product.is_blocked && product.blocked_reason && (
        <p className="text-sm bg-destructive/10 text-destructive rounded-lg px-3 py-2">Bloqueado: {product.blocked_reason}</p>
      )}
      {product.is_approved ? (
        <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => run(() => unpublishProduct(product.id), "Producto retirado de la tienda.")}>
          Despublicar
        </Button>
      ) : (
        <Button type="button" className="w-full" disabled={pending || !ready} onClick={() => run(() => publishProduct(product.id), "¡Publicado!")}>
          {pending ? "Publicando…" : "Publicar en la tienda"}
        </Button>
      )}
      <Feedback error={error} done={done} />
    </section>
  );
}

// --- Solo administración ------------------------------------------------------------

export function AdminControls({ product }: { product: Product }) {
  const pricing = useAction();
  const stock = useAction();
  const block = useAction();
  const [price, setPrice] = useState({
    overridden: product.price_overridden,
    price: String(product.price),
    old: product.old_price ? String(product.old_price) : "",
    featured: product.is_featured,
  });
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [buffer, setBuffer] = useState(String(product.stock_buffer));
  const [reason, setReason] = useState("");
  const [currentStock, setCurrentStock] = useState(product.stock);

  function submitStock(sign: 1 | -1) {
    const n = Number(delta);
    stock.run(() => adjustStock(product.id, sign * n, note), "Stock actualizado.", (data) => {
      if (data) setCurrentStock(data.stock);
      setDelta("");
      setNote("");
    });
  }

  return (
    <section className={`${panel} border-amber-200`}>
      <h2 className="font-display font-semibold">Administración</h2>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Precio</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="w-4 h-4 accent-primary" checked={price.overridden} onChange={(e) => setPrice({ ...price, overridden: e.target.checked })} />
          Fijar precio web manualmente (Eleventa ya no lo cambia)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="price">Precio (MXN)</label>
            <Input id="price" type="number" min={0.01} step={0.01} value={price.price} disabled={!price.overridden} onChange={(e) => setPrice({ ...price, price: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="old">Precio tachado (oferta)</label>
            <Input id="old" type="number" min={0} step={0.01} value={price.old} disabled={!price.overridden} placeholder="Opcional" onChange={(e) => setPrice({ ...price, old: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="w-4 h-4 accent-primary" checked={price.featured} onChange={(e) => setPrice({ ...price, featured: e.target.checked })} />
          Destacado en la página de inicio
        </label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={pricing.pending}
            onClick={() =>
              pricing.run(
                () => savePricing(product.id, { price_overridden: price.overridden, price: Number(price.price), old_price: price.old ? Number(price.old) : null, is_featured: price.featured }),
                "Precio guardado."
              )
            }
          >
            Guardar precio
          </Button>
          <Feedback error={pricing.error} done={pricing.done} />
        </div>
      </div>

      <hr className="border-border" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Inventario web</h3>
        <p className="text-sm">
          Stock actual: <span className="font-semibold">{currentStock}</span>
          {product.stock_buffer > 0 && <span className="text-muted-foreground"> (se venden en línea {Math.max(0, currentStock - product.stock_buffer)}; {product.stock_buffer} reservados para mostrador)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          Cuando el agente de Eleventa esté conectado, el stock se sincroniza solo y los ajustes manuales se reemplazan en el siguiente ciclo.
        </p>
        <div className="grid sm:grid-cols-[6rem_1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="delta">Cantidad</label>
            <Input id="delta" type="number" min={1} step={1} value={delta} onChange={(e) => setDelta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="note">Motivo</label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Conteo físico, mercancía dañada…" maxLength={300} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={stock.pending || !delta} onClick={() => submitStock(1)} aria-label="Sumar"><Plus className="w-4 h-4" /></Button>
            <Button type="button" variant="outline" disabled={stock.pending || !delta} onClick={() => submitStock(-1)} aria-label="Restar"><Minus className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="buffer">Reserva para mostrador</label>
            <Input id="buffer" type="number" min={0} step={1} value={buffer} onChange={(e) => setBuffer(e.target.value)} className="w-24" />
          </div>
          <Button type="button" variant="outline" disabled={stock.pending} onClick={() => stock.run(() => setStockBuffer(product.id, Number(buffer)), "Reserva guardada.")}>
            Guardar reserva
          </Button>
        </div>
        <Feedback error={stock.error} done={stock.done} />
      </div>

      <hr className="border-border" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Bloqueo</h3>
        {product.is_blocked ? (
          <Button type="button" variant="outline" disabled={block.pending} onClick={() => block.run(() => setProductBlocked(product.id, false, ""), "Producto desbloqueado. Ya se puede volver a publicar.")}>
            Desbloquear
          </Button>
        ) : (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium" htmlFor="reason">Motivo</label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Solo en tienda física, producto frágil…" maxLength={300} />
            </div>
            <Button type="button" variant="destructive" className="gap-1.5" disabled={block.pending} onClick={() => block.run(() => setProductBlocked(product.id, true, reason), "Producto bloqueado y retirado de la tienda.")}>
              <Ban className="w-4 h-4" /> Bloquear
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Un producto bloqueado no se vende en línea y los empleados no pueden publicarlo.</p>
        <Feedback error={block.error} done={block.done} />
      </div>
    </section>
  );
}
