import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elarbolitotoys.mx";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Juguetería El Arbolito | Culiacán, desde 1975",
    template: "%s | Juguetería El Arbolito",
  },
  description: "Juguetes para todas las edades. Más de 2,000 productos. Envíos a todo México desde Culiacán, Sinaloa. ¡50 años de tradición!",
  keywords: ["juguetería", "juguetes", "Culiacán", "Sinaloa", "El Arbolito", "juguetes México", "juguetería en línea"],
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: SITE_URL,
    siteName: "Juguetería El Arbolito",
    title: "Juguetería El Arbolito | Culiacán, desde 1975",
    description: "Más de 2,000 juguetes para todas las edades. Envíos a todo México.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Juguetería El Arbolito",
    description: "Juguetes para todas las edades. Envíos a todo México.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" className={`${poppins.variable} ${inter.variable}`}>
      <body className="font-body antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
