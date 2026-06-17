"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Category } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Props {
  categories: Category[];
  currentParams: Record<string, string | undefined>;
}

export default function CatalogFilters({ categories, currentParams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [minPrice, setMinPrice] = useState(currentParams.precio_min ?? "");
  const [maxPrice, setMaxPrice] = useState(currentParams.precio_max ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("pagina");
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyPrice() {
    const params = new URLSearchParams(searchParams.toString());
    if (minPrice) params.set("precio_min", minPrice);
    else params.delete("precio_min");
    if (maxPrice) params.set("precio_max", maxPrice);
    else params.delete("precio_max");
    params.delete("pagina");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasFilters = !!(currentParams.categoria || currentParams.precio_min || currentParams.precio_max);
  const [mobileOpen, setMobileOpen] = useState(hasFilters);

  return (
    <div className="border border-border rounded-xl lg:border-0 lg:rounded-none">
      {/* Mobile toggle header */}
      <button
        className="lg:hidden w-full flex items-center justify-between px-4 py-3 font-display font-semibold text-sm"
        onClick={() => setMobileOpen((v) => !v)}
      >
        <span>Filtros{hasFilters ? ` (activos)` : ""}</span>
        <span className="text-muted-foreground">{mobileOpen ? "▲" : "▼"}</span>
      </button>

      <div className={`space-y-6 px-4 pb-4 lg:px-0 lg:pb-0 ${mobileOpen ? "block" : "hidden"} lg:block`}>
        <div className="hidden lg:flex items-center justify-between">
          <h2 className="font-display font-semibold">Filtros</h2>
          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-destructive hover:underline">
              Limpiar
            </button>
          )}
        </div>
        {/* Mobile clear */}
        {hasFilters && (
          <div className="lg:hidden">
            <button onClick={clearAll} className="text-xs text-destructive hover:underline">
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Categorías */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            Categoría
          </h3>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => updateParam("categoria", null)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  !currentParams.categoria
                    ? "bg-primary text-white font-medium"
                    : "hover:bg-surface"
                }`}
              >
                Todos
              </button>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <button
                  onClick={() => updateParam("categoria", cat.slug)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    currentParams.categoria === cat.slug
                      ? "bg-primary text-white font-medium"
                      : "hover:bg-surface"
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Rango de precio */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            Precio (MXN)
          </h3>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              placeholder="Mín"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-8 text-sm"
              min={0}
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="number"
              placeholder="Máx"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-8 text-sm"
              min={0}
            />
          </div>
          <Button size="sm" className="w-full mt-2" onClick={applyPrice}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}
