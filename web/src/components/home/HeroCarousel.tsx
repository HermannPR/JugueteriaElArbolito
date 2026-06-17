"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  images: string[];
  intervalMs?: number;
}

export default function HeroCarousel({ images, intervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = images.length;

  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + count) % count),
    [count]
  );

  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(t);
  }, [paused, count, intervalMs]);

  return (
    <section
      className="relative h-[60vh] min-h-[420px] max-h-[680px] w-full overflow-hidden bg-[#0f2472] text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {images.map((src, i) => (
        <div
          key={src}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            i === index ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={i !== index}
        >
          <Image
            src={src}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ))}

      {/* Legibility gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />

      {/* Overlay content */}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white text-sm font-medium px-3 py-1 rounded-full mb-5">
            Juguetería El Arbolito · Desde 1975
          </div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-tight mb-5 drop-shadow-lg">
            Juguetes para <span className="text-yellow-300">todos</span> los momentos
          </h1>
          <p className="text-white/90 text-lg sm:text-xl mb-7 leading-relaxed drop-shadow">
            Más de 2,000 juguetes seleccionados. Envíos a todo México desde nuestra tienda en Culiacán.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/productos" className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary hover:bg-white/90 font-bold shadow-lg")}>
              Ver catálogo <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
            <Link href="/nosotros" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "bg-transparent border-white/60 text-white hover:bg-white/15 hover:text-white font-semibold backdrop-blur-sm")}>
              Nuestra historia
            </Link>
          </div>
        </div>
      </div>

      {/* Arrows */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Anterior"
            className="absolute z-20 left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-sm flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Siguiente"
            className="absolute z-20 right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-sm flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Counter */}
          <div className="absolute z-20 bottom-4 right-5 text-xs font-medium bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full tabular-nums">
            {index + 1} / {count}
          </div>
        </>
      )}
    </section>
  );
}
