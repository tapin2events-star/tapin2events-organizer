import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Organization > Brand kit: connect the organization's own web address for its white-labeled events.
interface Status { hostname?: string; status?: 'pending' | 'active' | 'error'; detail?: string | null }
export default function CustomDomainCard({ orgId }: { orgId: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [host, setHost] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { supabase.rpc('org_domain_status', { p_org_id: orgId }).then(({ data }) => setS((data ?? {}) as Status)); }, [orgId]);
  useEffect(() => { load(); }, [load]);
  async function call(action: 'add' | 'check' | 'remove') {
    if (action === 'remove' && !window.confirm(`Disconnect ${s?.hostname}? Links using it will stop working.`)) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke('custom-domain', { body: { action, org_id: orgId, hostname: host } });
    let msg: string | null = data?.error ?? null;
    if (!msg && error) { try { msg = (await (error as { context?: Response }).context?.json())?.error ?? 'Something went wrong.'; } catch { msg = 'Something went wrong.'; } }
    setBusy(false);
    if (msg) return setErr(msg);
    if (action === 'remove') setHost('');
    load();
  }
  const sub = s?.hostname ? s.hostname.split('.')[0] : 'tickets';
  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="font-display text-lg font-bold text-gray-900">🌐 Custom domain</h3>
      <p className="mt-1 text-sm text-gray-600">Show your white-labeled events at your own address, like <strong>tickets.yourorganization.com</strong>, fully branded.</p>
      {s === null ? null : !s.hostname ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="tickets.yourorganization.com" aria-label="Web address" autoCapitalize="none" autoCorrect="off" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm" />
          <button onClick={() => call('add')} disabled={busy || !host.trim()} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Connecting…' : 'Connect'}</button>
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
