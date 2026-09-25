"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { CartItem } from "@/types";

const CART_KEY = "arbolito_cart";
const EMPTY: CartItem[] = [];

// Un solo carrito compartido por todos los componentes (navbar, tarjetas,
// página de carrito). Antes cada useCart() tenía su propia copia y el contador
// del navbar no cambiaba al agregar un producto hasta recargar la página.
let current: CartItem[] | null = null;
const listeners = new Set<() => void>();

function read(): CartItem[] {
  if (current) return current;
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    current = Array.isArray(parsed) ? parsed : [];
  } catch {
    current = [];
  }
  return current;
}

function write(items: CartItem[]) {
  current = items;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado): el carrito vive solo en esta pestaña.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Otra pestaña cambió el carrito.
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_KEY) {
      current = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);

  const addItem = useCallback((product: CartItem["product"], quantity = 1) => {
    const prev = read();
    const maxStock = Math.max(0, product.stock - product.stock_buffer);
    const existing = prev.find((i) => i.product.id === product.id);
    write(
      existing
        ? prev.map((i) => (i.product.id === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, maxStock) } : i))
        : [...prev, { product, quantity: Math.min(quantity, maxStock) }]
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    write(read().filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    write(
      read()
        .map((i) => (i.product.id === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => write([]), []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return { items, itemCount, subtotal, addItem, removeItem, updateQuantity, clearCart };
}
