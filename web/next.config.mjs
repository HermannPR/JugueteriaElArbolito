const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "localhost";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fotos de producto: el navegador las reduce antes, pero el tope real es 4 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: {
    // Las fotos viven en el Storage del proyecto Supabase configurado.
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
