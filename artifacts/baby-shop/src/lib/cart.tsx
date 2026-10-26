import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartItem { productId: number; name: string; price: number; imageUrl: string | null; sku: string; quantity: number; }
interface CartCtx {
  items: CartItem[]; count: number; total: number; bump: number;
  open: boolean; setOpen: (v: boolean) => void;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (id: number, qty: number) => void; remove: (id: number) => void; clear: () => void;
}
const Ctx = createContext<CartCtx | null>(null);
const KEY = "ptashenya-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);
  const add = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.productId === item.productId);
      if (ex) return prev.map((i) => i.productId === item.productId ? { ...i, ...item, quantity: Math.min(999, i.quantity + qty) } : i);
      return [...prev, { ...item, quantity: qty }];
    });
    setBump((b) => b + 1);
  }, []);
  const setQty = useCallback((id: number, qty: number) => setItems((p) => p.map((i) => i.productId === id ? { ...i, quantity: Math.max(1, Math.min(999, qty)) } : i)), []);
  const remove = useCallback((id: number) => setItems((p) => p.filter((i) => i.productId !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({
    items, open, setOpen, add, setQty, remove, clear, bump,
    count: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.quantity * i.price, 0),
  }), [items, open, add, setQty, remove, clear, bump]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}

export function flyToCart(from: HTMLElement | null, imageUrl: string | null) {
  const target = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]")).find((el) => el.offsetParent !== null);
  if (!from || !target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement("div");
  const size = 44;
  Object.assign(dot.style, {
    position: "fixed", left: a.left + a.width / 2 - size / 2 + "px", top: a.top + a.height / 2 - size / 2 + "px",
    width: size + "px", height: size + "px", borderRadius: "999px", zIndex: "100", pointerEvents: "none",
    background: imageUrl ? "#fff url(" + JSON.stringify(imageUrl) + ") center/cover" : "hsl(14 88% 55%)",
    boxShadow: "0 8px 24px hsl(14 88% 40% / .35)", border: "3px solid hsl(14 88% 55%)",
  });
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = dot.animate([
    { transform: "translate(0,0) scale(1)", opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(.85)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(.25)`, opacity: .6 },
  ], { duration: 720, easing: "cubic-bezier(.5,0,.3,1)" });
  anim.onfinish = () => dot.remove();
}
