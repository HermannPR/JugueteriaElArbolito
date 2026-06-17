"use client";

import { useState, useEffect, useCallback } from "react";
import type { CartItem } from "@/types";

const CART_KEY = "arbolito_cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readCart());
  }, []);

  const addItem = useCallback((product: CartItem["product"], quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const maxStock = Math.max(0, product.stock - product.stock_buffer);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(i.quantity + quantity, maxStock) }
            : i
        );
      } else {
        updated = [...prev, { product, quantity: Math.min(quantity, maxStock) }];
      }
      writeCart(updated);
      return updated;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.product.id !== productId);
      writeCart(updated);
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      const updated = prev
        .map((i) => (i.product.id === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0);
      writeCart(updated);
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    writeCart([]);
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return { items, itemCount, subtotal, addItem, removeItem, updateQuantity, clearCart };
}
