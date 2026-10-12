import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadMyOrgs, type EventKind, type MyOrg } from '../../lib/business';

const KINDS: { key: EventKind; title: string; desc: string; icon: string }[] = [
  { key: 'community', title: 'Community', desc: 'Shows, parties, open mics, meetups', icon: '🎤' },
  { key: 'business', title: 'Business', desc: 'Conferences, summits, workshops, networking', icon: '💼' },
  { key: 'nonprofit', title: 'Nonprofit', desc: 'Galas, fundraisers, benefit events', icon: '💛' },
];

// Event type picker (TapIN for Business). Business and nonprofit events belong to an organization.
export default function EventKindPicker({ kind, onKind, orgId, onOrg }: { kind: EventKind; onKind: (k: EventKind) => void; orgId: string | null; onOrg: (id: string | null) => void }) {
  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  useEffect(() => { loadMyOrgs().then(setOrgs); }, []);
  const fitting = (orgs ?? []).filter((o) => o.role !== 'member' && (kind === 'community' || o.kind === kind || kind === 'business'));
  useEffect(() => {
    if (kind === 'community') { if (orgId) onOrg(null); return; }
    if (orgs && !orgId && fitting.length === 1) onOrg(fitting[0].id);
  }, [kind, orgs]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <p className="text-sm font-semibold text-bone">What kind of event is this?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button type="button" key={k.key} onClick={() => onKind(k.key)} aria-pressed={kind === k.key}
            className={`rounded-xl border p-3 text-left transition ${kind === k.key ? 'border-marigold bg-white shadow-sm ring-1 ring-marigold' : 'border-gray-200 bg-white/70'}`}>
            <span className="text-xl">{k.icon}</span>
            <span className="mt-1 block text-sm font-bold text-gray-900">{k.title}</span>
            <span className="block text-xs text-gray-500">{k.desc}</span>
          </button>
        ))}
      </div>
      {kind !== 'community' && (
        <div className="mt-3">
          {orgs === null ? <p className="text-xs text-muted">Loading your organizations…</p> : fitting.length === 0 ? (
            <p className="text-sm text-muted">{kind === 'nonprofit' ? 'Nonprofit' : 'Business'} events belong to an organization. <Link to="/business" className="font-medium text-marigold">Create one first</Link>.</p>
          ) : (
            <label className="text-xs font-medium text-gray-500">Organization
              <select value={orgId ?? ''} onChange={(e) => onOrg(e.target.value || null)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900">
                <option value="">Choose…</option>
                {fitting.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          )}
          <p className="mt-2 text-xs text-muted">After saving, add the agenda, speakers and sponsors from the event's dashboard (Business page tab).</p>
        </div>
      )}
    </div>
  );
}
