import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface VendorFeeTier {
  tier_name: string;
  fee: number;
}
interface VendorGroup {
  group_name: string;
  description?: string;
}

interface VendorApplicationFormProps {
  eventId: string;
  feeTiers: VendorFeeTier[];
  groups: VendorGroup[];
}

export default function VendorApplicationForm({ eventId, feeTiers, groups }: VendorApplicationFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!businessName.trim() || !description.trim()) {
      setError('Business name and description are required.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const selectedTier = feeTiers[selectedTierIndex] ?? null;
    const { error: insertError } = await supabase.from('event_vendor_applications').insert({
      event_id: eventId,
      resource_email: user.email,
      business_name: businessName,
      description,
      requirements: requirements || null,
      selected_fee_tier: selectedTier,
      agreed_fee: selectedTier?.fee ?? 0,
      status: 'pending',
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
        <p className="font-medium text-green-800">Application submitted!</p>
        <p className="mt-1 text-sm text-green-700">
          The organizer will review it and follow up. You can check your status anytime on{' '}
          <Link to="/activity" className="underline">My Activity</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-gray-50 p-5">
      {groups.length > 0 && (
        <p className="text-sm text-gray-500">Categories: {groups.map((g) => g.group_name).join(', ')}</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Business name
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          What will you be offering?
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Anything else the organizer should know? (optional)
          <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={2} className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900" placeholder="Power/water needs, table size, etc." />
        </label>

        {feeTiers.length > 0 && (
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Vendor fee tier
            <select
              value={selectedTierIndex}
              onChange={(e) => setSelectedTierIndex(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            >
              {feeTiers.map((t, i) => (
                <option key={i} value={i}>{t.tier_name || 'Standard'} — ${t.fee}</option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="text-sm text-magenta">{error}</p>}

        <button type="submit" disabled={submitting} className="mt-1 rounded-lg bg-marigold px-4 py-2.5 font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
        <p className="text-xs text-gray-400">No payment now — you'll be able to pay once the organizer approves your application.</p>
      </div>
    </form>
  );
}
