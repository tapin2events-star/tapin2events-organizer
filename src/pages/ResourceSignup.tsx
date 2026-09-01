import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { RESOURCE_CATEGORIES, type PricingType, type Resource } from '../lib/types';
import PublicHeader from '../components/discover/PublicHeader';
import ImageUpload from '../components/ImageUpload';

export default function ResourceSignup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [existing, setExisting] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [pricingType, setPricingType] = useState<PricingType>('contact_quote');
  const [baseRate, setBaseRate] = useState('');
  const [pricingDetails, setPricingDetails] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!user.email) return;
    (async () => {
      const { data } = await supabase.from('resources').select('*').eq('email', user.email).maybeSingle();
      if (data) {
        const r = data as Resource;
        setExisting(r);
        setDisplayName(r.display_name);
        setCategories(r.categories);
        setBio(r.bio);
        setCity(r.city ?? '');
        setState(r.state ?? '');
        setProfileImage(r.profile_image ?? '');
        setPricingType(r.pricing_type);
        setBaseRate(r.base_rate ? String(r.base_rate) : '');
        setPricingDetails(r.pricing_details ?? '');
        setInstagramUrl(r.instagram_url ?? '');
        setFacebookUrl(r.facebook_url ?? '');
        setWebsiteUrl(r.website_url ?? '');
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate, location.pathname]);

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    if (categories.length === 0) {
      setError('Pick at least one category.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      display_name: displayName,
      email: user.email,
      categories,
      bio,
      city: city || null,
      state: state || null,
      profile_image: profileImage || null,
      pricing_type: pricingType,
      base_rate: baseRate ? parseFloat(baseRate) : 0,
      pricing_details: pricingDetails || null,
      instagram_url: instagramUrl || null,
      facebook_url: facebookUrl || null,
      website_url: websiteUrl || null,
    };

    const { error: saveError } = existing
      ? await supabase.from('resources').update(payload).eq('id', existing.id)
      : await supabase.from('resources').insert(payload);

    setSaving(false);
    if (saveError) {
      setError('Something went wrong saving your profile. Please try again.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    if (!existing) {
      const { data } = await supabase.from('resources').select('*').eq('email', user.email).single();
      if (data) setExisting(data as Resource);
    }
  }

  if (loading) return (<><PublicHeader /><div className="p-10 text-center text-gray-500">Loading…</div></>);

  const fieldClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-gray-900">
          {existing ? 'Edit your resource profile' : 'Become a Resource'}
        </h1>
        <p className="mt-1 text-gray-500">
          {existing ? 'Update the details organizers see about you.' : 'List your services so organizers can discover and reach you.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Display name
            <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={fieldClass} placeholder="Your name or business name" />
          </label>

          <div>
            <p className="text-sm font-medium text-gray-700">Categories</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RESOURCE_CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    categories.includes(c) ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Bio
            <textarea required rows={4} value={bio} onChange={(e) => setBio(e.target.value)} className={fieldClass} placeholder="Tell organizers about your services, experience, and style" />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              State
              <input value={state} onChange={(e) => setState(e.target.value)} className={fieldClass} />
            </label>
          </div>

          <ImageUpload currentUrl={profileImage || null} onUploaded={setProfileImage} pathPrefix="resources" label="Profile photo" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Pricing type
              <select value={pricingType} onChange={(e) => setPricingType(e.target.value as PricingType)} className={fieldClass}>
                <option value="contact_quote">Contact for quote</option>
                <option value="fixed">Fixed rate</option>
                <option value="hourly">Hourly rate</option>
              </select>
            </label>
            {pricingType !== 'contact_quote' && (
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Rate ($)
                <input type="number" min="0" step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} className={fieldClass} />
              </label>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Pricing details (optional)
            <textarea rows={2} value={pricingDetails} onChange={(e) => setPricingDetails(e.target.value)} className={fieldClass} placeholder="Packages, add-ons, travel fees, etc." />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Instagram
              <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={fieldClass} placeholder="https://" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Facebook
              <input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className={fieldClass} placeholder="https://" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Website
              <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={fieldClass} placeholder="https://" />
            </label>
          </div>

          {error && <p className="text-sm text-magenta">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : existing ? 'Save changes' : 'Create my profile'}
          </button>
        </form>

        {existing && (
          <Link to="/resources/dashboard" className="mt-4 inline-block text-sm font-medium text-marigold hover:underline">
            View your booking requests &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
