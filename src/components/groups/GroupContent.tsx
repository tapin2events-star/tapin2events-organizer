import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import ProductManager from '../products/ProductManager';
import { rpcError } from '../../lib/groups';

interface MyPost { id: string; caption: string | null; thumbnail_url: string | null; group_id: string | null; created_at: string }
interface GroupPost { id: string; caption: string | null; thumbnail_url: string | null; author_email: string; author_name?: string | null }
interface GroupProduct { id: string; name: string; images: string[] | null; seller_email: string; price: number }

const btn = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold disabled:opacity-50';

function Thumb({ url }: { url: string | null }) {
  return url
    ? <img src={url} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
    : <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-gray-900 text-xs text-white">▶</span>;
}

// Videos and merch on the group's page: each member chooses what of theirs to show;
// owners/admins can take anything off the page.
export default function GroupContent({ groupId, groupName, isAdmin }: { groupId: string; groupName: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<MyPost[] | null>(null);
  const [groupPosts, setGroupPosts] = useState<GroupPost[]>([]);
  const [groupProducts, setGroupProducts] = useState<GroupProduct[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllMine, setShowAllMine] = useState(false);

  async function load() {
    if (!user?.email) return;
    const [{ data: m }, { data: gp }, { data: pr }] = await Promise.all([
      supabase.from('posts').select('id, caption, thumbnail_url, group_id, created_at').eq('author_email', user.email).eq('status', 'active').order('created_at', { ascending: false }).limit(30),
      isAdmin ? supabase.from('posts').select('id, caption, thumbnail_url, author_email').eq('group_id', groupId).eq('status', 'active').order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from('products').select('id, name, images, seller_email, price').eq('resource_id', groupId).eq('is_active', true).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    setMine((m ?? []) as MyPost[]);
    const posts = (gp ?? []) as GroupPost[];
    const emails = [...new Set(posts.map((p) => p.author_email))];
    if (emails.length) {
      const { data: people } = await supabase.from('public_profiles').select('email, full_name').in('email', emails);
      const names = new Map((people ?? []).map((p) => [p.email, p.full_name]));
      posts.forEach((p) => { p.author_name = names.get(p.author_email) ?? null; });
    }
    setGroupPosts(posts);
    setGroupProducts((pr ?? []) as GroupProduct[]);
  }
  useEffect(() => { load(); }, [groupId, user?.email, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleMine(p: MyPost) {
    setBusy(p.id); setError(null);
    const next = p.group_id === groupId ? null : groupId;
    const { error: e } = await supabase.from('posts').update({ group_id: next }).eq('id', p.id);
    setBusy(null);
    if (e) return setError(rpcError(e, "Couldn't update that video."));
    setMine((prev) => (prev ?? []).map((x) => (x.id === p.id ? { ...x, group_id: next } : x)));
    if (isAdmin) load();
  }

  async function removeItem(kind: 'post' | 'product', id: string) {
    setBusy(id); setError(null);
    const { error: e } = await supabase.rpc('remove_from_group', { p_kind: kind, p_id: id });
    setBusy(null);
    if (e) return setError(rpcError(e));
    load();
  }

  const visibleMine = showAllMine ? mine ?? [] : (mine ?? []).slice(0, 6);

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-bone">Videos &amp; merch on the group page</h2>
      <p className="mt-1 text-xs text-muted">Nothing of yours shows on {groupName}'s page unless you choose it here (or pick the group when posting a video).</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <h3 className="mt-4 text-sm font-semibold text-bone">Your videos</h3>
      {mine === null ? <p className="mt-2 text-sm text-muted">Loading…</p> : mine.length === 0 ? (
        <p className="mt-2 text-sm text-muted">You haven't posted any videos yet. When you post one from the Feed, you can choose to show it here.</p>
      ) : (
        <>
          <ul className="mt-2 flex flex-col gap-2">
            {visibleMine.map((p) => {
              const here = p.group_id === groupId;
              const elsewhere = p.group_id && !here;
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2">
                  <Thumb url={p.thumbnail_url} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-gray-800">{p.caption || 'Untitled video'}</p>
                    {elsewhere && <p className="text-xs text-gray-400">Showing on another group</p>}
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-gray-700">
                    <input type="checkbox" className="h-5 w-5 accent-marigold" checked={here} disabled={busy === p.id} onChange={() => toggleMine(p)} />
                    Show here
                  </label>
                </li>
              );
            })}
          </ul>
          {mine.length > 6 && <button onClick={() => setShowAllMine((v) => !v)} className="mt-2 text-xs font-medium text-marigold">{showAllMine ? 'Show fewer' : `Show all ${mine.length}`}</button>}
        </>
      )}

      <h3 className="mt-5 text-sm font-semibold text-bone">Your merch for {groupName}</h3>
      <p className="mt-1 text-xs text-muted">Products you list here appear in the group's shop. You're the seller: orders and payments come to you.</p>
      {user?.email && <div className="mt-2"><ProductManager ownerType="resource" ownerId={groupId} sellerEmail={user.email} onlyMine /></div>}

      {isAdmin && (groupPosts.length > 0 || groupProducts.length > 0) && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-bone">Everything on the group page</h3>
          <p className="mt-1 text-xs text-muted">As an admin, you can take any member's video or product off the group page. It stays on their own profile.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {groupPosts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2">
                <Thumb url={p.thumbnail_url} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-gray-800">{p.caption || 'Untitled video'}</p>
                  <p className="text-xs text-gray-400">Video · {p.author_email === user?.email ? 'you' : p.author_name || 'a member'}</p>
                </div>
                <button className={btn} disabled={busy === p.id} onClick={() => removeItem('post', p.id)}>Remove</button>
              </li>
            ))}
            {groupProducts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2">
                {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-500">Item</span>}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">Product · ${Number(p.price).toFixed(2)}</p>
                </div>
                <button className={btn} disabled={busy === p.id} onClick={() => removeItem('product', p.id)}>Hide</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
