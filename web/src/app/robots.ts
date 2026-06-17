import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elarbolitotoys.mx";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/checkout", "/carrito", "/pedido/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
