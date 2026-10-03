// Encuentra la foto principal en el HTML de la ficha de un producto, para que
// "Importar desde liga" acepte la página y no solo la dirección de la imagen.
// Sin imports a propósito, para probarlo con node --test.

// En orden de preferencia: casi todas las tiendas (Shopify, Tiendanube, Amazon,
// Mercado Libre) publican la foto principal en og:image.
const KEYS = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x2F;|&#47;/gi, "/");
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities((m[1] ?? m[2] ?? m[3] ?? "").trim()) : null;
}

function absolute(raw: string, base: string): string | null {
  try {
    const url = new URL(raw, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** URL absoluta de la foto principal de la página, o null si no declara ninguna. */
export function findPageImage(html: string, baseUrl: string): string | null {
  const found = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (KEYS.includes(key) && content && !found.has(key)) found.set(key, content);
  }
  for (const key of KEYS) {
    const url = found.has(key) ? absolute(found.get(key)!, baseUrl) : null;
    if (url) return url;
  }
  const link = (html.match(/<link\b[^>]*>/gi) ?? []).find((t) => (attr(t, "rel") ?? "").toLowerCase() === "image_src");
  const href = link ? attr(link, "href") : null;
  return href ? absolute(href, baseUrl) : null;
}
