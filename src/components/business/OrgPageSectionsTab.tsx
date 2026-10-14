import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ListSkeleton } from '../ui/Skeleton';

interface Artist { id: string; name: string; photo: string | null; categories: string[] | null; city: string | null }
interface Video { id: string; thumbnail: string | null; caption: string | null; author: string | null }
interface Product { id: string; name: string; price: number; image: string | null; seller: string | null }
const money = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

// Organization > Page: choose what the public page features: artists (from TapIN artist profiles),
// videos (Feed videos from the team and roster artists) and a shop (their products). Owners, Admins, Editors.
export default function OrgPageSectionsTab({ orgId, slug }: { orgId: string; slug: string }) {
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [videos, setVideos] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [cand, setCand] = useState<{ videos: Video[]; products: Product[] } | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Artist[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2500); };

  const load = useCallback(async () => {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.rpc('org_page_sections', { p_org_id: orgId }),
      supabase.rpc('org_section_candidates', { p_org_id: orgId }),
    ]);
    const sec = (s ?? { artists: [], videos: [], products: [] }) as { artists: Artist[]; videos: Video[]; products: Product[] };
    setArtists(sec.artists); setVideos(sec.videos.map((v) => v.id)); setProducts(sec.products.map((p) => p.id));
    setCand((c ?? { videos: [], products: [] }) as { videos: Video[]; products: Product[] });
  }, [orgId]);
  useEffect(() => { load(); }, [load]);

  // Artist search (TapIN artist & resource profiles).
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      supabase.from('resources').select('id, display_name, profile_image, categories, city').eq('status', 'active').ilike('display_name', `%${q.trim()}%`).limit(8)
        .then(({ data }) => setResults(((data ?? []) as { id: string; display_name: string; profile_image: string | null; categories: string[] | null; city: string | null }[]).map((r) => ({ id: r.id, name: r.display_name, photo: r.profile_image, categories: r.categories, city: r.city }))));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function saveSection(section: 'artists' | 'videos' | 'products', ids: string[]) {
    const { error } = await supabase.rpc('set_org_section', { p_org_id: orgId, p_section: section, p_ids: ids });
    flash(error ? "Couldn't save." : 'Saved. It\u2019s on your page now.');
    if (section === 'artists') load();
  }
  const move = (list: Artist[], i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= list.length) return list; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; return n; };

  if (!artists || !cand) return <ListSkeleton rows={4} />;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Choose what your public page features. Everything here comes from TapIN profiles, the Feed and shops, so it stays up to date.</p>
        <Link to={`/o/${slug}`} className="text-sm font-medium text-marigold">View page ›</Link>
      </div>
      {msg && <p role="status" className="-mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

      {/* Artists */}
      <section>
        <h3 className="font-display text-lg font-bold text-bone">🎤 Our artists</h3>
        <p className="text-sm text-muted">Artists and creatives you work with. Each links to their TapIN profile with bio, photos, videos and booking.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search artists by name" aria-label="Search artists" className="mt-3 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm" />
        {results.length > 0 && (
          <ul className="mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {results.map((r) => {
              const added = artists.some((a) => a.id === r.id);
              return (
                <li key={r.id} className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0">
                  {r.photo ? <img src={r.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{r.name.charAt(0)}</span>}
                  <span className="min-w-0 flex-1 truncate text-gray-900">{r.name}<span className="text-gray-500">{r.categories?.length ? ` · ${r.categories.slice(0, 2).join(', ')}` : ''}</span></span>
                  <button disabled={added} onClick={() => { const next = [...artists, r]; setArtists(next); saveSection('artists', next.map((a) => a.id)); setQ(''); }} className="shrink-0 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500">{added ? 'Added' : 'Add'}</button>
                </li>
              );
            })}
          </ul>
        )}
        {artists.length === 0 ? <p className="mt-3 text-sm text-muted">No artists added yet.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {artists.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-2.5">
                {a.photo ? <img src={a.photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{a.name.charAt(0)}</span>}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-bone">{a.name}</span>
                <button onClick={() => { const n = move(artists, i, -1); setArtists(n); saveSection('artists', n.map((x) => x.id)); }} disabled={i === 0} aria-label="Move up" className="px-2 text-gray-500 disabled:opacity-30">↑</button>
                <button onClick={() => { const n = move(artists, i, 1); setArtists(n); saveSection('artists', n.map((x) => x.id)); }} disabled={i === artists.length - 1} aria-label="Move down" className="px-2 text-gray-500 disabled:opacity-30">↓</button>
                <button onClick={() => { const n = artists.filter((x) => x.id !== a.id); setArtists(n); saveSection('artists', n.map((x) => x.id)); }} className="px-2 text-xs text-gray-400 hover:text-red-600">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Videos */}
      <section>
        <h3 className="font-display text-lg font-bold text-bone">🎬 Videos</h3>
        <p className="text-sm text-muted">Feature Feed videos posted by your team and your artists. Tap to add or remove; they play in the Feed.</p>
        {cand.videos.length === 0 ? <p className="mt-3 text-sm text-muted">No Feed videos from your team or artists yet. Post one from the Feed (+ button), then feature it here.</p> : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {cand.videos.map((v) => {
              const on = videos.includes(v.id);
              return (
                <button key={v.id} type="button" aria-pressed={on} onClick={() => { const n = on ? videos.filter((x) => x !== v.id) : [...videos, v.id]; setVideos(n); saveSection('videos', n); }}
                  className={`relative overflow-hidden rounded-xl border-2 text-left ${on ? 'border-marigold' : 'border-transparent'}`}>
                  {v.thumbnail ? <img src={v.thumbnail} alt="" className="aspect-[9/16] w-full object-cover" /> : <span className="flex aspect-[9/16] w-full items-center justify-center bg-gray-800 text-2xl">🎬</span>}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] leading-tight text-white">{v.author}</span>
                  {on && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-marigold text-xs font-bold text-white">{videos.indexOf(v.id) + 1}</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Shop */}
      <section>
        <h3 className="font-display text-lg font-bold text-bone">🛍️ Shop</h3>
        <p className="text-sm text-muted">Feature books, merch and other items sold on TapIN by your team and your artists. Buyers check out with the seller, as usual.</p>
        {cand.products.length === 0 ? <p className="mt-3 text-sm text-muted">No items for sale from your team or artists yet. Artists can add items from their profile's shop, and you can sell merch from an event's Products tab.</p> : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cand.products.map((p) => {
              const on = products.includes(p.id);
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => { const n = on ? products.filter((x) => x !== p.id) : [...products, p.id]; setProducts(n); saveSection('products', n); }}
                  className={`overflow-hidden rounded-xl border-2 bg-white text-left ${on ? 'border-marigold' : 'border-gray-200'}`}>
                  {p.image ? <img src={p.image} alt="" className="aspect-square w-full object-cover" /> : <span className="flex aspect-square w-full items-center justify-center bg-gray-100 text-3xl">🛍️</span>}
                  <span className="block p-2"><span className="block truncate text-sm font-medium text-gray-900">{p.name}</span><span className="block text-xs text-gray-500">{money(p.price)}{p.seller ? ` · ${p.seller}` : ''}</span></span>
                  {on && <span className="block bg-marigold py-1 text-center text-xs font-semibold text-white">On your page</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
