# JugueteriaElArbolito

<p><img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" height="20" alt="Next.js"> <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" height="20" alt="TypeScript"> <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" height="20" alt="Supabase"> <img src="https://img.shields.io/badge/Mercado_Pago-009EE3?style=flat-square" height="20" alt="Mercado Pago"></p>

Web store for ElArbolito

Production e-commerce for a real toy store, with an admin dashboard and point-of-sale synced to Mercado Pago.

## Run it

The web app lives in `web/`:

```bash
cd web
npm install
npm run dev
```

## Demo mode

If the Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) aren't configured, the storefront automatically renders built-in sample products and shows a "Modo demo" banner, so the public preview works without a backend. Connect Supabase to show live inventory.

## Screenshots

![Storefront](docs/storefront.png)

Storefront home (categories, featured products and product cards).

![Admin login](docs/admin.png)

Admin area login page.
