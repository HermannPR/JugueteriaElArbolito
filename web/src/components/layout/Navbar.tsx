"use client";

import Link from "next/link";
import { ShoppingCart, Search, Menu, X, TreePine } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/hooks/useCart";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { itemCount } = useCart();
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/productos?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-[#1E40AF] rounded-lg flex items-center justify-center">
              <TreePine className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-display font-bold text-primary text-lg leading-none block">
                El Arbolito
              </span>
              <span className="text-muted-foreground text-xs leading-none">
                Desde 1975
              </span>
            </div>
          </Link>

          {/* Búsqueda */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden sm:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar juguetes..."
                className="pl-9 bg-surface border-border focus-visible:ring-accent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <Link href="/carrito">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile search */}
        {menuOpen && (
          <div className="sm:hidden pb-4 space-y-3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar juguetes..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
            <nav className="flex flex-col gap-1">
              <Link href="/productos" className="py-2 px-3 text-sm font-medium hover:bg-surface rounded-md" onClick={() => setMenuOpen(false)}>
                Catálogo
              </Link>
              <Link href="/cuenta" className="py-2 px-3 text-sm font-medium hover:bg-surface rounded-md" onClick={() => setMenuOpen(false)}>
                Mi cuenta
              </Link>
            </nav>
          </div>
        )}
      </div>

      {/* Nav secundaria */}
      <nav className="hidden sm:block bg-[#1E40AF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-6 h-10 overflow-x-auto scrollbar-hide">
            <Link href="/productos" className="text-white/90 hover:text-white text-sm font-medium whitespace-nowrap transition-colors">
              Todo el catálogo
            </Link>
            <Link href="/categoria/didacticos" className="text-white/90 hover:text-white text-sm whitespace-nowrap transition-colors">
              📚 Didácticos
            </Link>
            <Link href="/categoria/munecas-y-bebes" className="text-white/90 hover:text-white text-sm whitespace-nowrap transition-colors">
              👶 Muñecas y bebés
            </Link>
            <Link href="/categoria/deportes" className="text-white/90 hover:text-white text-sm whitespace-nowrap transition-colors">
              ⚽ Deportes
            </Link>
            <Link href="/categoria/dinosaurios" className="text-white/90 hover:text-white text-sm whitespace-nowrap transition-colors">
              🦕 Dinosaurios
            </Link>
            <Link href="/categoria/libros" className="text-white/90 hover:text-white text-sm whitespace-nowrap transition-colors">
              📖 Libros
            </Link>
            <Link href="/categoria/coleccionables" className="text-white/90 hover:text-white text-sm whitespace-nowrap transition-colors">
              ⭐ Coleccionables
            </Link>
            <Link href="/categoria/casitas-y-juegos-de-jardin" className="text-white/90 hover:text-white text-sm whitespace-nowrap transition-colors">
              🏡 Casitas
            </Link>
            <Link href="/categoria/mi-alegria" className="text-white/90 hover:text-white text-sm whitespace-nowrap transition-colors">
              🎉 Mi alegría
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
