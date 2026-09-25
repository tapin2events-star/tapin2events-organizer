import { Link } from 'react-router-dom';

export interface CreatorProduct {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
}

export default function CreatorProducts({ products }: { products: CreatorProduct[] }) {
  if (products.length === 0) return <p className="mt-3 text-sm text-muted">Nothing for sale right now.</p>;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((p) => (
        <Link key={p.id} to={`/products/${p.id}`} className="overflow-hidden rounded-xl border border-gray-200 bg-surface hover:border-marigold">
          {p.images?.[0] ? (
            <img src={p.images[0]} alt="" className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-gray-100 text-3xl">🛍️</div>
          )}
          <div className="p-2.5">
            <p className="truncate text-sm font-medium text-bone">{p.name}</p>
            <p className="text-sm font-semibold text-marigold">${Number(p.price).toFixed(2)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
