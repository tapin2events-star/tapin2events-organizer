import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { VendorApplication, VendorApplicationStatus } from '../../lib/types';

const STATUS_STYLES: Record<VendorApplicationStatus, string> = {
  pending: 'bg-marigold/20 text-marigold',
  approved: 'bg-mint/20 text-mint',
  paid: 'bg-mint/20 text-mint',
  rejected: 'bg-magenta/20 text-magenta',
  withdrawn: 'bg-surface2 text-muted',
};

export default function VendorApplicationsTab({ eventId }: { eventId: string }) {
  const [apps, setApps] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVendor, setNewVendor] = useState({ business_name: '', email: '', description: '', agreed_fee: '0' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('event_vendor_applications')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    setApps((data ?? []) as VendorApplication[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [eventId]);

  async function setStatus(id: string, status: VendorApplicationStatus) {
    await supabase.from('event_vendor_applications').update({ status }).eq('id', id);
    load();
  }

  async function addVendorDirectly(e: React.FormEvent) {
    e.preventDefault();
    if (!newVendor.business_name.trim() || !newVendor.email.trim()) {
      setError('Business name and email are required.');
      return;
    }
    setSaving(true);
    setError(null);
    // Organizer-added vendors skip the application step entirely — they
    // already have a relationship with this vendor, so it's created
    // pre-approved rather than pending review.
    const { error: insertError } = await supabase.from('event_vendor_applications').insert({
      event_id: eventId,
      resource_email: newVendor.email.trim().toLowerCase(),
      business_name: newVendor.business_name,
      description: newVendor.description || 'Added directly by organizer',
      agreed_fee: Number(newVendor.agreed_fee) || 0,
      status: 'approved',
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewVendor({ business_name: '', email: '', description: '', agreed_fee: '0' });
    setShowAddForm(false);
    load();
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {apps.length === 0
            ? 'No vendors yet. Enable vendor applications when editing this event, or add one you already have below.'
            : `${apps.length} vendor${apps.length === 1 ? '' : 's'}`}
        </p>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-bone hover:border-marigold hover:text-marigold"
        >
          {showAddForm ? 'Cancel' : '+ Add vendor I already have'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={addVendorDirectly} className="mb-4 flex flex-col gap-2 rounded-xl bg-surface p-4">
          <div className="flex gap-2">
            <input
              placeholder="Business name"
              value={newVendor.business_name}
              onChange={(e) => setNewVendor({ ...newVendor, business_name: e.target.value })}
              className="flex-1 rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone"
            />
            <input
              placeholder="Vendor email"
              value={newVendor.email}
              onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
              className="flex-1 rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone"
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={newVendor.description}
            onChange={(e) => setNewVendor({ ...newVendor, description: e.target.value })}
            rows={2}
            className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone"
          />
          <input
            type="number"
            placeholder="Fee ($, 0 if none)"
            value={newVendor.agreed_fee}
            onChange={(e) => setNewVendor({ ...newVendor, agreed_fee: e.target.value })}
            className="max-w-[160px] rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone"
          />
          {error && <p className="text-xs text-magenta">{error}</p>}
          <button type="submit" disabled={saving} className="self-start rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50">
            {saving ? 'Adding…' : 'Add vendor'}
          </button>
        </form>
      )}

      {apps.length > 0 && (
        <ul className="flex flex-col gap-3">
          {apps.map((app) => (
            <li key={app.id} className="rounded-xl bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-bone">{app.business_name}</p>
                  <p className="font-mono text-xs text-muted">{app.resource_email}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${STATUS_STYLES[app.status]}`}
                >
                  {app.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">{app.description}</p>
              <p className="mt-1 font-mono text-xs text-bone">Fee: ${app.agreed_fee?.toFixed(2)}</p>

              {app.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setStatus(app.id, 'approved')}
                    className="rounded-lg bg-mint/20 px-3 py-1.5 text-xs font-semibold text-mint hover:bg-mint/30"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setStatus(app.id, 'rejected')}
                    className="rounded-lg bg-magenta/20 px-3 py-1.5 text-xs font-semibold text-magenta hover:bg-magenta/30"
                  >
                    Reject
                  </button>
                </div>
              )}
              {app.status === 'approved' && app.agreed_fee > 0 && (
                <button
                  onClick={() => setStatus(app.id, 'paid')}
                  className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-bone hover:border-marigold hover:text-marigold"
                >
                  Mark fee as paid (outside the app)
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
