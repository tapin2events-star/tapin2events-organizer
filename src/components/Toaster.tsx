import { useEffect, useState } from 'react';
import type { ToastKind } from '../lib/toast';

// Shows toast() messages: above the phone navigation bar, bottom-center on desktop. Read out by screen readers.
interface Item { id: number; text: string; kind: ToastKind }
let next = 1;
export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: ToastKind }>).detail;
      const id = next++;
      // Keep the latest few; replace an identical message instead of stacking duplicates.
      setItems((xs) => [...xs.filter((x) => x.text !== text).slice(-2), { id, text, kind }]);
      window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 4500 : 2500);
    };
    window.addEventListener('tapin-toast', on);
    return () => window.removeEventListener('tapin-toast', on);
  }, []);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 z-[2000] flex flex-col items-center gap-2 px-4 md:bottom-6"
      style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))' }}>
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto max-w-sm rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${t.kind === 'error' ? 'bg-red-600' : 'bg-[#0F1B3D]'}`}
          style={{ animation: 'tapin-toast-in 160ms ease-out' }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
