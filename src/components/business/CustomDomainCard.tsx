import { useCallback, useEffect, useState } from 'react';
import { toast, toastError } from '../../lib/toast';
import { supabase } from '../../lib/supabaseClient';

// Organization > Brand kit: connect the organization's own web address for its white-labeled events.
interface Status { hostname?: string; status?: 'pending' | 'active' | 'error'; detail?: string | null }
const ZONE = 'tapin2events.com';
export default function CustomDomainCard({ orgId, slug }: { orgId: string; slug?: string | null }) {
  const [free, setFree] = useState((slug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40));
  const [mode, setMode] = useState<'free' | 'own'>('free');
  const [s, setS] = useState<Status | null>(null);
  const [host, setHost] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { supabase.rpc('org_domain_status', { p_org_id: orgId }).then(({ data }) => setS((data ?? {}) as Status)); }, [orgId]);
  useEffect(() => { load(); }, [load]);
  async function call(action: 'add' | 'check' | 'remove') {
    if (action === 'remove' && !window.confirm(`Disconnect ${s?.hostname}? Links using it will stop working.`)) return;
    setBusy(true); setErr(null);
    const hostname = mode === 'free' ? `${free.trim().toLowerCase()}.${ZONE}` : host;
    const { data, error } = await supabase.functions.invoke('custom-domain', { body: { action, org_id: orgId, hostname } });
    let msg: string | null = data?.error ?? null;
    if (!msg && error) { try { msg = (await (error as { context?: Response }).context?.json())?.error ?? 'Something went wrong.'; } catch { msg = 'Something went wrong.'; } }
    setBusy(false);
    if (msg) { toastError(msg); return setErr(msg); }
    toast(action === 'remove' ? 'Domain disconnected' : action === 'add' ? '✓ Domain connected' : '✓ Status updated');
    if (action === 'remove') setHost('');
    load();
  }
  const sub = s?.hostname ? s.hostname.split('.')[0] : 'tickets';
  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="font-display text-lg font-bold text-gray-900">🌐 Custom domain</h3>
      <p className="mt-1 text-sm text-gray-600">Show your white-labeled events at their own address, fully branded.</p>
      {s === null ? null : !s.hostname ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Address type">
            <button type="button" role="radio" aria-checked={mode === 'free'} onClick={() => setMode('free')} className={`rounded-xl border px-3 py-2 text-left text-sm ${mode === 'free' ? 'border-marigold bg-marigold/10 font-semibold text-gray-900' : 'border-gray-300 text-gray-700'}`}>Free address<span className="block text-xs font-normal text-gray-500">name.{ZONE} · instant</span></button>
            <button type="button" role="radio" aria-checked={mode === 'own'} onClick={() => setMode('own')} className={`rounded-xl border px-3 py-2 text-left text-sm ${mode === 'own' ? 'border-marigold bg-marigold/10 font-semibold text-gray-900' : 'border-gray-300 text-gray-700'}`}>Your own domain<span className="block text-xs font-normal text-gray-500">tickets.yourorg.com · one record</span></button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {mode === 'free' ? (
              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-gray-300 bg-white pr-3">
                <input value={free} onChange={(e) => setFree(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="yourname" aria-label="Your free address" autoCapitalize="none" autoCorrect="off" className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 text-base text-gray-900 outline-none sm:text-sm" />
                <span className="shrink-0 text-sm text-gray-500">.{ZONE}</span>
              </div>
            ) : (
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="tickets.yourorganization.com" aria-label="Web address" autoCapitalize="none" autoCorrect="off" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm" />
            )}
            <button onClick={() => call('add')} disabled={busy || (mode === 'free' ? free.trim().length < 3 : !host.trim())} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Connecting…' : 'Connect'}</button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{s.hostname}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.status === 'active' ? 'bg-green-100 text-green-800' : s.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
              {s.status === 'active' ? 'Active' : s.status === 'error' ? 'Needs attention' : 'Connecting…'}
            </span>
          </div>
          {s.status === 'active' ? (
            <p className="mt-2 text-sm text-gray-600">Live! Your white-labeled events are at <a href={`https://${s.hostname}`} target="_blank" rel="noopener" className="font-semibold text-marigold underline">https://{s.hostname}</a>.</p>
          ) : s.hostname.endsWith(`.${ZONE}`) ? (
            <p className="mt-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">Setting up your address and its security certificate automatically. This usually takes a few minutes. Tap <strong>Check status</strong> to refresh.</p>
          ) : (
            <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Add this record where your domain is managed (GoDaddy, Namecheap, Squarespace, etc.):</p>
              <div className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-[13px]">
                <span className="text-gray-500">Type</span><span>CNAME</span>
                <span className="text-gray-500">Name</span><span>{sub}</span>
                <span className="text-gray-500">Value</span><span className="[overflow-wrap:anywhere]">tapin2events.pages.dev</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{s.detail || 'After adding it, connecting usually takes a few minutes (sometimes a few hours). The security certificate is set up automatically.'}</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {s.status !== 'active' && <button onClick={() => call('check')} disabled={busy} className="font-semibold text-marigold disabled:opacity-50">{busy ? 'Checking…' : 'Check status'}</button>}
            <button onClick={() => call('remove')} disabled={busy} className="font-medium text-gray-500 hover:text-red-600 disabled:opacity-50">Disconnect</button>
          </div>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
    </section>
  );
}
