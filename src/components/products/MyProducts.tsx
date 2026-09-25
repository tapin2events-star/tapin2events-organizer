import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import ProductManager from './ProductManager';
import ProductOrdersPanel from './ProductOrdersPanel';

interface Owner {
  key: string;
  type: 'event' | 'resource';
  id: string;
  title: string;
  subtitle: string;
  sellerEmail: string;
  productCount: number;
  upcoming: boolean;
}

// Every product a person sells, in one place: their resource profile's
// products and each of their events' products. Each section reuses the same
// ProductManager + ProductOrdersPanel found on the event page and Resource
// Dashboard, so adding, editing, stock, and fulfillment all work identically.
export default function MyProducts() {
  const { user } = useAuth();
  const [withProducts, setWithProducts] = useState<Owner[]>([]);
  const [upcomingEmpty, setUpcomingEmpty] = useState<Owner[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hasAnyStorefront, setHasAnyStorefront] = useState(false);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: resource }, { data: events }, { data: products }] = await Promise.all([
        supabase.from('resources').select('id, display_name, email').eq('email', user.email!).maybeSingle(),
        supabase.from('events').select('id, title, start_date, organizer_email').eq('organizer_id', user.id).order('start_date', { ascending: true }),
        supabase.from('products').select('event_id, resource_id').eq('seller_email', user.email!),
      ]);

      const counts = new Map<string, number>();
      (products ?? []).forEach((p) => {
        const key = p.resource_id ? `resource:${p.resource_id}` : p.event_id ? `event:${p.event_id}` : null;
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      });

      const owners: Owner[] = [];
      if (resource) {
        owners.push({
          key: `resource:${resource.id}`,
          type: 'resource',
          id: resource.id,
          title: resource.display_name?.trim() || 'My resource profile',
          subtitle: 'Resource profile',
          sellerEmail: resource.email,
          productCount: counts.get(`resource:${resource.id}`) ?? 0,
          upcoming: true,
        });
      }
      const now = Date.now();
      (events ?? []).forEach((e) => {
        owners.push({
          key: `event:${e.id}`,
          type: 'event',
          id: e.id,
          title: e.title,
          subtitle: e.start_date
            ? new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Date TBD',
          sellerEmail: e.organizer_email,
          productCount: counts.get(`event:${e.id}`) ?? 0,
          upcoming: !e.start_date || new Date(e.start_date).getTime() >= now,
        });
      });

      const selling = owners.filter((o) => o.productCount > 0);
      // Places with no products yet: your resource profile, plus upcoming
      // events (past events with nothing to sell are left out to keep this short).
      const empty = owners.filter(
        (o) => o.productCount === 0 && (o.type === 'resource' || o.upcoming)
      );

      setHasAnyStorefront(owners.length > 0);
      setWithProducts(selling);
      setUpcomingEmpty(empty);
      setExpanded(new Set(selling.map((o) => o.key)));
      setLoading(false);
    })();
  }, [user]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!user) {
    return (
      <p className="mt-6 text-gray-500">
        <Link to="/login" className="font-medium text-marigold">Sign in</Link> to manage the products you sell.
      </p>
    );
  }
  if (loading) return <p className="mt-6 text-gray-500">Loading…</p>;

  if (!hasAnyStorefront) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold text-gray-900">Start selling on TapIN</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          Products are sold through an event you organize or through your resource profile. Set up either one, and you can add products here.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to="/organizer/new" className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white">Create an event</Link>
          <Link to="/resources/new" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900">Set up a resource profile</Link>
        </div>
      </div>
    );
  }

  const section = (o: Owner) => (
    <div key={o.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button onClick={() => toggle(o.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{o.title}</p>
          <p className="text-xs text-gray-500">
            {o.type === 'resource' ? 'Resource profile' : `Event · ${o.subtitle}`}
            {' · '}
            {o.productCount} product{o.productCount === 1 ? '' : 's'}
          </p>
        </div>
        <span className="shrink-0 text-gray-400">{expanded.has(o.key) ? '▲' : '▼'}</span>
      </button>
      {expanded.has(o.key) && (
        <div className="flex flex-col gap-4 border-t border-gray-200 p-4">
          <ProductManager ownerType={o.type} ownerId={o.id} sellerEmail={o.sellerEmail} />
          <ProductOrdersPanel ownerType={o.type} ownerId={o.id} />
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      {withProducts.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-900">Selling now</p>
          {withProducts.map(section)}
        </div>
      ) : (
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
          You're not selling anything yet. Pick a place below to add your first product.
        </p>
      )}
      {upcomingEmpty.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-900">Add products to</p>
          {upcomingEmpty.map(section)}
        </div>
      )}
    </div>
  );
}
