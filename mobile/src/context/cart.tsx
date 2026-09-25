import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { Product } from '@/lib/types';

const CART_KEY = 'pharmlit.cart';

export interface CartLine {
  product: Pick<
    Product,
    'id' | 'name' | 'price' | 'stock' | 'requiresPrescription' | 'strength' | 'packSize' | 'categoryIcon' | 'categoryColor' | 'imageUrl'
  >;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  count: number;
  subtotal: number;
  requiresPrescription: boolean;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  quantityOf: (productId: number) => number;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .then((raw) => raw && setLines(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(CART_KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines, hydrated]);

  const value = useMemo<CartState>(() => {
    const clamp = (q: number, stock: number) => Math.max(0, Math.min(q, stock, 100));
    return {
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((s, l) => s + l.product.price * l.quantity, 0),
      requiresPrescription: lines.some((l) => l.product.requiresPrescription),
      add: (p, quantity = 1) =>
        setLines((prev) => {
          const snapshot: CartLine['product'] = {
            id: p.id, name: p.name, price: p.price, stock: p.stock, requiresPrescription: p.requiresPrescription,
            strength: p.strength, packSize: p.packSize, categoryIcon: p.categoryIcon, categoryColor: p.categoryColor,
            imageUrl: p.imageUrl,
          };
          const existing = prev.find((l) => l.product.id === p.id);
          if (existing) {
            return prev.map((l) =>
              l.product.id === p.id ? { product: snapshot, quantity: clamp(l.quantity + quantity, p.stock) } : l,
            );
          }
          return [...prev, { product: snapshot, quantity: clamp(quantity, p.stock) }];
        }),
      setQuantity: (id, quantity) =>
        setLines((prev) =>
          prev
            .map((l) => (l.product.id === id ? { ...l, quantity: clamp(quantity, l.product.stock) } : l))
            .filter((l) => l.quantity > 0),
        ),
      remove: (id) => setLines((prev) => prev.filter((l) => l.product.id !== id)),
      clear: () => setLines([]),
      quantityOf: (id) => lines.find((l) => l.product.id === id)?.quantity ?? 0,
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
