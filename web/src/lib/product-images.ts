import "server-only";
import { lookup } from "dns/promises";
import { isIP } from "net";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findPageImage } from "@/lib/page-image";

const BUCKET = "product-images";
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const MAX_PAGE_BYTES = 3 * 1024 * 1024; // las meta og:image van en el <head>
const MAX_SIDE = 1200;
const MIN_SIDE = 200;

export class ImageError extends Error {}

/** Normaliza cualquier imagen a WebP ≤1200 px, respetando la orientación EXIF. */
export async function toWebp(input: Buffer): Promise<Buffer> {
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new ImageError("El archivo no es una imagen válida.");
  }
  if (!meta.width || !meta.height) throw new ImageError("El archivo no es una imagen válida.");
  if (Math.max(meta.width, meta.height) < MIN_SIDE) {
    throw new ImageError(`La imagen es muy pequeña (${meta.width}×${meta.height}). Usa una de al menos ${MIN_SIDE} px.`);
  }
  return sharp(input, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

// --- Descarga segura desde URL -----------------------------------------------
// El servidor descarga la URL que escribe un empleado: sin estos filtros alguien
// podría hacer que el servidor consulte direcciones internas (SSRF).

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageError("La URL no es válida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImageError("Solo se aceptan URLs http o https.");
  if (url.username || url.password) throw new ImageError("La URL no puede llevar usuario ni contraseña.");
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new ImageError("No se encontró el sitio de esa URL.");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new ImageError("Esa URL apunta a una red privada.");
  return url;
}

/** GET a una URL pública siguiendo redirecciones a mano, para validar cada destino. */
async function fetchPublic(raw: string, accept: string): Promise<{ res: Response; url: URL }> {
  let url = await assertPublicUrl(raw.trim());
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "ElArbolitoBot/1.0 (+catalogo)", Accept: accept },
    }).catch(() => {
      throw new ImageError("No se pudo descargar (el sitio no respondió).");
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) throw new ImageError(`El sitio respondió con error ${res.status}.`);
    return { res, url };
  }
  throw new ImageError("La URL redirige demasiadas veces.");
}

/** Lee el cuerpo con tope de tamaño (content-length puede faltar o mentir). */
async function readCapped(res: Response, maxBytes: number, tooBig: string): Promise<Buffer> {
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new ImageError(tooBig);
  const reader = res.body?.getReader();
  if (!reader) throw new ImageError("La descarga llegó vacía.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ImageError(tooBig);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Dirección de la imagen que se importaría desde esta URL, sin descargarla (para
 * mostrar la vista previa). Si es una página, la foto que declara (og:image).
 */
export async function resolveImageUrl(raw: string): Promise<string> {
  const { res, url } = await fetchPublic(raw, "image/*,text/html;q=0.8");
  if (isImage(res)) {
    await res.body?.cancel();
    return url.toString();
  }
  return imageFromPage(res, url);
}

function isImage(res: Response): boolean {
  return (res.headers.get("content-type") ?? "").toLowerCase().startsWith("image/");
}

/** La foto principal que declara una página HTML ya descargada. */
async function imageFromPage(res: Response, url: URL): Promise<string> {
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("text/html") && !type.startsWith("application/xhtml")) {
    await res.body?.cancel();
    throw new ImageError("Esa URL no es una imagen ni la página de un producto.");
  }
  const html = (await readCapped(res, MAX_PAGE_BYTES, "La página es demasiado grande para leerla.")).toString("utf8");
  const imageUrl = findPageImage(html, url.toString());
  if (!imageUrl) {
    throw new ImageError("Esa página no indica su foto principal. Abre la imagen y usa \"Copiar dirección de la imagen\".");
  }
  return imageUrl;
}

/**
 * Descarga la imagen de una URL. Si la URL es la ficha del producto (HTML), toma
 * la foto principal que declara la página (og:image) y descarga esa.
 */
export async function downloadImage(raw: string): Promise<Buffer> {
  const { res, url } = await fetchPublic(raw, "image/*,text/html;q=0.8");
  if (isImage(res)) return readCapped(res, MAX_DOWNLOAD_BYTES, "La imagen pesa más de 10 MB.");
  const imageUrl = await imageFromPage(res, url);

  // Un solo salto: la foto declarada debe ser una imagen, no otra página.
  const img = await fetchPublic(imageUrl, "image/*");
  if (!isImage(img.res)) {
    await img.res.body?.cancel();
    throw new ImageError("La foto que indica la página no se pudo abrir como imagen. Copia la dirección de la imagen a mano.");
  }
  return readCapped(img.res, MAX_DOWNLOAD_BYTES, "La imagen pesa más de 10 MB.");
}

// --- Guardar en Storage --------------------------------------------------------

/**
 * Sube la foto (ya en WebP) con una ruta nueva cada vez: así el CDN nunca sirve
 * la foto anterior en caché. Luego apunta el producto a ella y borra la vieja.
 */
export async function saveProductImage(db: SupabaseClient, productId: string, webp: Buffer): Promise<string> {
  const path = `products/${productId}/${Date.now()}.webp`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, webp, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (upErr) throw new Error(`No se pudo subir la imagen: ${upErr.message}`);
  const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);

  const { data: previous } = await db.from("products").select("image_url").eq("id", productId).single();
  const { error: updErr } = await db.from("products").update({ image_url: publicUrl }).eq("id", productId);
  if (updErr) {
    await db.storage.from(BUCKET).remove([path]);
    throw new Error(`No se pudo guardar la imagen en el producto: ${updErr.message}`);
  }
  await removeStoredImage(db, previous?.image_url ?? null);
  return publicUrl;
}

/** Borra del bucket una foto nuestra (ignora URLs externas o vacías). */
export async function removeStoredImage(db: SupabaseClient, imageUrl: string | null) {
  const marker = `/object/public/${BUCKET}/`;
  if (!imageUrl?.includes(marker)) return;
  await db.storage.from(BUCKET).remove([imageUrl.split(marker)[1]]);
}
