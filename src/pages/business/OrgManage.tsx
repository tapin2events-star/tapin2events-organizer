import { useCallback, useEffect, useState } from 'react';
import { toast, toastSaved, toastError } from '../../lib/toast';
import TransferOwnershipSheet from '../../components/TransferOwnershipSheet';
import CustomDomainCard from '../../components/business/CustomDomainCard';
import { AddExistingEventsSheet } from '../../components/business/MoveEvents';
import WebsiteEmbedCard from '../../components/promote/WebsiteEmbedCard';
import TeamPeopleShortcut from '../../components/business/TeamPeopleShortcut';
import OrgReelManager from '../../components/video/OrgReelManager';
import VideoHeaderCard from '../../components/video/VideoHeaderCard';
import { OrgPromoterPayouts } from '../../components/promote/PromoterPayouts';
import { OrgPlanStatus } from '../../components/business/PlanCheckout';
import { useNavigate } from 'react-router-dom';
import OrgPageSectionsTab from '../../components/business/OrgPageSectionsTab';
import OrgAudienceTab from '../../components/business/OrgAudienceTab';
import { useFeature } from '../../lib/preview';
import { OrgPromoteTab, OrgSales, useOrgAttendance } from '../../components/business/OrgInsights';
import { ListSkeleton } from '../../components/ui/Skeleton';
import OrgPayoutsTab from '../../components/business/OrgPayoutsTab';
import OrgPhotosTab from '../../components/business/OrgPhotosTab';
import DeleteOrgSheet from '../../components/business/DeleteOrgSheet';
import EarlyAccessBadge from '../../components/business/EarlyAccessBadge';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import BackButton from '../../components/BackButton';
import BusinessGate from '../../components/business/BusinessGate';
import ImagePicker from '../../components/business/ImagePicker';
import { BRAND_FONTS, DEFAULT_BRAND, loadFont, type Brand, type Organization } from '../../lib/business';

type Tab = 'Profile' | 'Brand kit' | 'Page' | 'Planning' | 'Team' | 'Events' | 'Audience' | 'Promote' | 'Payouts';
const TAB_ICON: Record<Tab, string> = { Profile: '🏢', 'Brand kit': '🎨', Page: '🧩', Planning: '📋', Team: '👥', Events: '📅', Promote: '📣', Audience: '👥', Payouts: '💳' };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export default function OrgManage() {
  return <BusinessGate><OrgManageInner /></BusinessGate>;
}

function OrgManageInner() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { user, isAdmin } = useAuth();
  const [transferOpen, setTransferOpen] = useState(false);
  const [org, setOrg] = useState<Organization | null | undefined>(undefined);
  const [role, setRole] = useState<string | null | undefined>(undefined); // undefined = still checking
  const navigate = useNavigate();
  // Remember the open tab in the page address, so coming back (e.g. from "View page") returns to it.
  const setTab = (t: Tab) => {
    setTabState(t);
    const u = new URL(window.location.href);
    u.searchParams.set('tab', t);
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
  };
  const insightsOn = useFeature('org_insights');
  const newsletterOn = useFeature('newsletters');
  const billingOn = useFeature('billing');
  const promoterPayoutsOn = useFeature('promoter_payouts');
  const videoHeadersOn = useFeature('video_headers');
  const whiteLabelOn = useFeature('white_label');
  const isLead = role === 'owner' || role === 'admin';
  const canEditPage = role === 'owner' || role === 'admin' || role === 'editor';
  const tabList = (['Profile', 'Brand kit', ...(canEditPage ? ['Page'] : []), 'Planning', 'Team', 'Events', ...(isLead && insightsOn ? ['Audience', 'Promote'] : []), ...(isLead ? ['Payouts'] : [])] as Tab[]);
  const tabLabel = (t: Tab) => (t === 'Payouts' && insightsOn ? 'Sales & payouts' : t);
  const [tab, setTabState] = useState<Tab>(() => { const raw = new URLSearchParams(window.location.search).get('tab'); const t = raw === 'Photos' ? 'Page' : raw === 'Newsletter' ? 'Audience' : raw; return (['Profile', 'Brand kit', 'Page', 'Team', 'Events', 'Audience', 'Promote', 'Payouts'] as string[]).includes(t ?? '') ? (t as Tab) : 'Profile'; });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('organizations').select('*').eq('slug', slug).maybeSingle();
    const o = data ? ({ ...data, brand: { ...DEFAULT_BRAND, ...(data.brand ?? {}) } } as Organization) : null;
    if (o) {
      const { data: r } = await supabase.rpc('org_role', { p_org: o.id });
      setRole((r as string | null) ?? null);
    } else {
      setRole(null);
    }
    setOrg(o); // shown together with the role, so the page never flashes "not on the team"

  }, [slug]);
  useEffect(() => { load(); }, [load]);

  async function save(patch: Partial<Organization>) {
    if (!org) return;
    setMsg(null);
    const { error } = await supabase.from('organizations').update(patch).eq('id', org.id);
    if (error) { toastError(); return setMsg({ ok: false, text: "Couldn't save. Please try again." }); }
    setOrg({ ...org, ...patch });
    toastSaved();
    setMsg({ ok: true, text: 'Saved.' });
    window.setTimeout(() => setMsg(null), 2000);
  }

  if (org === undefined || (org && role === undefined)) return (
    <div className="mx-auto max-w-3xl animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-3 h-5 w-16 rounded bg-gray-200" />
      <div className="flex items-center gap-3"><div className="h-14 w-14 rounded-2xl bg-gray-200" /><div className="flex-1"><div className="h-6 w-40 rounded bg-gray-200" /><div className="mt-2 h-3 w-56 rounded bg-gray-100" /></div></div>
      <div className="mt-6 h-9 rounded-xl bg-gray-100" />
      <div className="mt-6 h-28 rounded-xl bg-gray-100" />
    </div>
  );
  if (!org || !role) return <p className="mt-8 text-center text-sm text-muted">This organization doesn't exist or you're not on its team. <Link to="/business" className="text-marigold">TapIN for Business</Link></p>;
  const canEdit = role === 'owner' || role === 'admin';

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <div className="mb-3"><BackButton fallback="/business" fallbackLabel="TapIN for Business" /></div>
      <div className="flex items-center gap-3">
        {org.logo_url ? <img src={org.logo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: org.brand.primary }}>{org.name.charAt(0)}</span>}
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold text-bone">{org.name}{org.verified && <span className="ml-1.5 text-[#C9A227]" title="Verified">✓</span>}</h1>
          {(org as Organization & { founding_number?: number | null }).founding_number ? (
            <p className="mt-1 inline-flex flex-wrap items-center gap-1 rounded-full bg-[#C9A227]/15 px-2.5 py-0.5 text-xs font-semibold text-[#8a6d12]">
              🎉 Founding member #{(org as Organization & { founding_number?: number | null }).founding_number}<span className="hidden sm:inline"> · 40% off the Business plan for life</span><span className="sm:hidden"> · 40% off for life</span>
            </p>
          ) : null}
          <p className="break-words text-xs text-muted">{org.kind === 'nonprofit' ? 'Nonprofit' : org.kind === 'community' ? 'Community group' : 'Business'} · you're {role === 'owner' ? 'the owner' : role === 'admin' ? 'an Admin' : role === 'editor' ? 'an Editor' : role === 'helper' ? 'a Helper' : 'a Viewer'} · <Link to={`/o/${org.slug}`} className="text-marigold">View public page</Link></p>
        </div>
      </div>

      {/* Phones: every section visible as a grid of buttons. Larger screens: underline tabs. */}
      <div className="mt-5 grid grid-cols-3 gap-2 sm:hidden" role="tablist" aria-label="Organization settings">
        {tabList.map((t) => (
          <button key={t} data-tour={`otab-${t}`} role="tab" aria-selected={tab === t} onClick={() => (t === 'Planning' ? navigate(`/organizer/planning?for=${org.slug}`) : setTab(t))}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold ${tab === t ? 'bg-[#0F1B3D] text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>
            <span className="text-base leading-none" aria-hidden="true">{TAB_ICON[t]}</span>{t === 'Payouts' && insightsOn ? 'Sales' : t}
          </button>
        ))}
      </div>
      <div className="mt-5 hidden border-b border-gray-200 sm:flex sm:gap-1" role="tablist" aria-label="Organization settings">
        {tabList.map((t) => (
          <button key={t} data-tour={`otab-${t}`} role="tab" aria-selected={tab === t} onClick={() => (t === 'Planning' ? navigate(`/organizer/planning?for=${org.slug}`) : setTab(t))} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-[#C9A227] text-bone' : 'border-transparent text-muted'}`}>{tabLabel(t)}</button>
        ))}
      </div>
      {org.status === 'deleted' && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-900">This organization was deleted.</p>
          <p className="mt-1 text-sm text-red-800">It's hidden from everyone{(org as Organization & { deleted_at?: string | null }).deleted_at ? ` and will be removed for good on ${new Date(new Date((org as Organization & { deleted_at?: string | null }).deleted_at as string).getTime() + 30 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}.</p>
          {role === 'owner' && <button onClick={async () => { const { error } = await supabase.rpc('restore_organization', { p_org_id: org.id }); if (error) setMsg({ ok: false, text: error.message }); else { setMsg({ ok: true, text: 'Restored.' }); load(); } }} className="mt-3 rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-bold text-white">Restore organization</button>}
        </div>
      )}
      {msg && <p role="status" className={`mt-3 text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}

      <div className="mt-5">
        {tab === 'Profile' && <ProfileTab org={org} canEdit={canEdit} onSave={save} />}
        {tab === 'Profile' && role === 'owner' && org.status !== 'deleted' && <DangerZone orgId={org.id} orgName={org.name} />}
        {tab === 'Brand kit' && <BrandTab org={org} canEdit={canEdit} onSave={save} />}
        {tab === 'Brand kit' && isLead && whiteLabelOn && <CustomDomainCard orgId={org.id} slug={org.slug} />}
        {tab === 'Team' && <Link to={`/team-chat/${org.id}`} className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-sm"><span><strong className="text-gray-900">💬 Team chat</strong><span className="block text-gray-600">Message everyone on {org.name}'s team, share photos and files</span></span><span className="shrink-0 font-semibold text-indigo-700">Open ›</span></Link>}
        {tab === 'Team' && canEditPage && <TeamPeopleShortcut orgId={org.id} onManage={() => { setTab('Page'); setTimeout(() => document.getElementById('featured-people')?.scrollIntoView({ behavior: 'smooth' }), 300); }} />}
        {tab === 'Team' && <TeamTab orgId={org.id} canEdit={canEdit} me={user?.email ?? ''} />}
        {tab === 'Team' && (role === 'owner' || isAdmin) && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="font-display text-lg font-bold text-gray-900">🔑 Transfer ownership</h3>
            <p className="mt-1 text-sm text-gray-600">Make someone else the Owner of {org.name}, for example if you set it up on their behalf. They accept by email, and you can stay on as an Admin.</p>
            <button onClick={() => setTransferOpen(true)} className="mt-3 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:border-marigold hover:text-marigold">Transfer ownership…</button>
          </section>
        )}
        {transferOpen && <TransferOwnershipSheet kind="organization" targetId={org.id} name={org.name} onClose={() => setTransferOpen(false)} />}
        {tab === 'Page' && canEditPage && videoHeadersOn && <VideoHeaderCard orgId={org.id} what="your organization page" />}
        {tab === 'Page' && canEditPage && <><OrgPageSectionsTab orgId={org.id} slug={org.slug} /><section className="mt-10 border-t border-gray-200 pt-8"><h3 className="font-display text-lg font-bold text-bone">📸 Photos</h3><p className="mb-3 text-sm text-muted">Up to 24 photos for your page's gallery.</p><OrgPhotosTab orgId={org.id} /></section>{videoHeadersOn && <OrgReelManager orgId={org.id} />}</>}
        {tab === 'Events' && <EventsTab org={org} canEdit={canEdit} insights={insightsOn && isLead} onAudience={() => setTab('Audience')} />}
        {tab === 'Promote' && isLead && insightsOn && <OrgPromoteTab orgId={org.id} />}
        {tab === 'Promote' && isLead && promoterPayoutsOn && <OrgPromoterPayouts orgId={org.id} />}
        {tab === 'Promote' && canEditPage && <WebsiteEmbedCard orgSlug={org.slug} />}
        {tab === 'Audience' && isLead && insightsOn && <OrgAudienceTab orgId={org.id} orgName={org.name} newsletterOn={newsletterOn} />}
        {tab === 'Payouts' && isLead && billingOn && <OrgPlanStatus orgId={org.id} />}
        {tab === 'Payouts' && isLead && insightsOn && <OrgSales orgId={org.id} />}
        {tab === 'Payouts' && (role === 'owner' || role === 'admin') && <OrgPayoutsTab orgId={org.id} orgName={org.name} slug={org.slug} />}
      </div>
    </div>
  );
}

function ProfileTab({ org, canEdit, onSave }: { org: Organization; canEdit: boolean; onSave: (p: Partial<Organization>) => void }) {
  const [f, setF] = useState({ name: org.name, tagline: org.tagline ?? '', description: org.description ?? '', website: org.website ?? '', contact_email: org.contact_email ?? '', city: org.city ?? '', state: org.state ?? '', ein: (org as { ein?: string | null }).ein ?? '' });
  const [einErr, setEinErr] = useState<string | null>(null);
  const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 disabled:bg-gray-50';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:gap-6">
        <ImagePicker label="Logo" value={org.logo_url} onChange={(url) => onSave({ logo_url: url })} hint="Square works best" crop />
        <ImagePicker label="Cover image" shape="wide" value={org.cover_url} onChange={(url) => onSave({ cover_url: url })} hint="Wide, at least 1600 px" crop />
      </div>
      <label className="text-xs font-medium text-gray-500">Name<input disabled={!canEdit} className={field} value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="text-xs font-medium text-gray-500">Tagline<input disabled={!canEdit} className={field} value={f.tagline} maxLength={160} onChange={(e) => setF({ ...f, tagline: e.target.value })} placeholder="One line about what you do" /></label>
      <label className="text-xs font-medium text-gray-500">About<textarea disabled={!canEdit} rows={4} className={field} value={f.description} maxLength={3000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-500">Website<input disabled={!canEdit} className={field} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" inputMode="url" /></label>
        <label className="text-xs font-medium text-gray-500">Contact email<input disabled={!canEdit} className={field} value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} inputMode="email" /></label>
        <label className="text-xs font-medium text-gray-500">City<input disabled={!canEdit} className={field} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
        <label className="text-xs font-medium text-gray-500">State<input disabled={!canEdit} className={field} value={f.state} maxLength={30} onChange={(e) => setF({ ...f, state: e.target.value })} /></label>
        {org.kind === 'nonprofit' && (
          <label className="text-xs font-medium text-gray-500 sm:col-span-2">EIN (optional, shown on donation receipts)
            <input disabled={!canEdit} className={field} value={f.ein} maxLength={10} inputMode="numeric" onChange={(e) => { setF({ ...f, ein: e.target.value.replace(/[^0-9-]/g, '') }); setEinErr(null); }} placeholder="12-3456789" />
            {einErr && <span className="mt-1 block text-red-600">{einErr}</span>}
          </label>
        )}
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-sm text-bone">
        <input type="checkbox" disabled={!canEdit} checked={(org as Organization & { listed?: boolean }).listed !== false} onChange={(e) => onSave({ listed: e.target.checked } as Partial<Organization>)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
        <span><strong>List in the Organizations directory</strong><span className="block text-xs text-muted">Shows your organization on TapIN's Organizations page and Discover. Turn off if you'd rather people reach your page only by link.</span></span>
      </label>
      {canEdit && <button onClick={() => { if (f.ein && !/^\d{2}-?\d{7}$/.test(f.ein)) { setEinErr('An EIN is 9 digits, like 12-3456789.'); return; } onSave({ ...f, name: f.name.trim() || org.name, website: f.website.trim() || null, contact_email: f.contact_email.trim() || null, ein: f.ein ? f.ein.replace(/^(\d{2})-?(\d{7})$/, '$1-$2') : null } as Partial<Organization>); }} className="self-start rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save profile</button>}
    </div>
  );
}

function BrandTab({ org, canEdit, onSave }: { org: Organization; canEdit: boolean; onSave: (p: Partial<Organization>) => void }) {
  const [b, setB] = useState<Brand>(org.brand);
  useEffect(() => { loadFont(b.font); }, [b.font]);
  const dark = b.theme === 'dark';
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">Set your brand once; every business event you create uses it automatically.</p>
        <div className="grid grid-cols-2 gap-3">
          {(['primary', 'accent'] as const).map((k) => (
            <label key={k} className="text-xs font-medium text-gray-500">{k === 'primary' ? 'Main color' : 'Accent color'}
              <div className="mt-1 flex min-w-0 items-center gap-2 rounded-xl border border-gray-300 bg-white p-1.5">
                <input type="color" disabled={!canEdit} value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent" />
                <input disabled={!canEdit} value={b[k]} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setB({ ...b, [k]: e.target.value })} className="min-w-0 flex-1 text-sm text-gray-900 outline-none" />
              </div>
            </label>
          ))}
        </div>
        <label className="text-xs font-medium text-gray-500"><span className="flex flex-wrap items-center gap-1.5">Font <EarlyAccessBadge /></span>
          <select disabled={!canEdit} value={b.font} onChange={(e) => setB({ ...b, font: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900">
            {BRAND_FONTS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <div className="text-xs font-medium text-gray-500"><span className="flex flex-wrap items-center gap-1.5">Page style <EarlyAccessBadge /></span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} disabled={!canEdit} onClick={() => setB({ ...b, theme: t })} className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${b.theme === t ? 'border-[#C9A227] bg-[#C9A227]/10 text-gray-900' : 'border-gray-200 bg-white text-gray-600'}`}>{t === 'light' ? 'Light' : 'Dark'}</button>
            ))}
          </div>
        </div>
        {canEdit && <button onClick={() => onSave({ brand: b })} className="self-start rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save brand kit</button>}
      </div>
      {/* Live preview */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm" style={{ fontFamily: `'${b.font}', system-ui, sans-serif`, background: dark ? '#0B1020' : '#fff', color: dark ? '#E5E7EB' : '#111827' }}>
        <div className="px-5 py-6 text-white" style={{ background: `linear-gradient(135deg, ${b.primary}, ${b.primary}cc)` }}>
          <div className="flex items-center gap-2">
            {org.logo_url ? <img src={org.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">{org.name.charAt(0)}</span>}
            <span className="text-sm font-semibold">{org.name}</span>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest" style={{ color: b.accent }}>Annual Summit · 2027</p>
          <p className="mt-1 text-2xl font-extrabold">Leading what's next</p>
          <span className="mt-4 inline-block rounded-full px-4 py-2 text-xs font-bold" style={{ background: b.accent, color: '#111827' }}>Get tickets</span>
        </div>
        <div className="space-y-2 p-5 text-sm">
          <p className="font-bold">Agenda</p>
          {['9:00 AM · Opening keynote', '10:30 AM · Panel: The future of work', '1:00 PM · Workshops'].map((x) => (
            <div key={x} className="rounded-lg px-3 py-2" style={{ background: dark ? '#111827' : '#F3F4F6', borderLeft: `3px solid ${b.accent}` }}>{x}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamTab({ orgId, canEdit, me }: { orgId: string; canEdit: boolean; me: string }) {
  const [members, setMembers] = useState<{ user_email: string; role: string; full_name?: string | null }[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from('organization_members').select('user_email, role').eq('org_id', orgId).order('created_at');
    const list = (data ?? []) as { user_email: string; role: string }[];
    const { data: ppl } = list.length ? await supabase.from('public_profiles').select('email, full_name').in('email', list.map((m) => m.user_email)) : { data: [] };
    const names = new Map((ppl ?? []).map((p) => [p.email, p.full_name]));
    setMembers(list.map((m) => ({ ...m, full_name: names.get(m.user_email) })));
  }, [orgId]);
  useEffect(() => { load(); }, [load]);
  async function add() {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setMsg('Enter a valid email.');
    const { error } = await supabase.from('organization_members').insert({ org_id: orgId, user_email: e, role, added_by: me });
    if (error) toastError(/duplicate/i.test(error.message) ? 'Already on the team.' : "Couldn't add them."); else toast('✓ Added to the team');
    setMsg(error ? (/duplicate/i.test(error.message) ? 'Already on the team.' : "Couldn't add them.") : `Added. We've emailed ${e} to let them know${role === 'admin' ? ' they can now manage this organization' : ''}.`);
    setEmail(''); load();
  }
  return (
    <div>
      <p className="text-sm text-muted">Everyone here is added to <strong>all of this organization's events</strong> (current and future) with their role. Owners and Admins also manage the organization itself.</p>
      {canEdit && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 sm:flex">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" className="col-span-2 min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-base text-gray-900" />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="admin">Admin: everything, including the team</option><option value="editor">Editor: edit events, lineups and tasks</option><option value="viewer">Viewer: see everything</option><option value="helper">Helper: their own tasks</option></select>
          <button onClick={add} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-bold text-white">Add</button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
      <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-surface">
        {members.map((m) => (
          <li key={m.user_email} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0"><span className="block truncate text-sm font-medium text-bone">{m.full_name || m.user_email}</span><span className="block text-xs text-muted">{({ owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer', helper: 'Helper' } as Record<string, string>)[m.role] ?? m.role}{m.user_email === me ? ' · you' : ''}</span></span>
            {canEdit && m.role !== 'owner' && (
              <span className="flex items-center gap-2">
                <select value={m.role} onChange={async (e) => { const { error: rErr } = await supabase.from('organization_members').update({ role: e.target.value }).eq('org_id', orgId).eq('user_email', m.user_email); if (rErr) toastError("Couldn't change the role."); else toast('✓ Role updated'); load(); }} aria-label="Role" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs">
                  <option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="helper">Helper</option>
                </select>
                <button onClick={async () => { const { error: dErr } = await supabase.from('organization_members').delete().eq('org_id', orgId).eq('user_email', m.user_email); if (dErr) toastError("Couldn't remove them."); else toast('Removed from the team'); load(); }} className="text-xs text-gray-400 hover:text-red-600">Remove</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventsTab({ org, canEdit, insights = false, onAudience }: { org: Organization; canEdit: boolean; insights?: boolean; onAudience?: () => void }) {
  const attendance = useOrgAttendance(org.id, insights);
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null; status: string; is_test: boolean }[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [movedMsg, setMovedMsg] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const reloadEvents = () => setReload((n) => n + 1);
  const isLeadHere = canEdit;
  useEffect(() => {
    supabase.from('events').select('id, title, start_date, status, is_test').eq('organization_id', org.id).order('start_date', { ascending: false }).then(({ data }) => { setEvents((data ?? []) as typeof events); setEventsLoaded(true); });
  }, [org.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      {canEdit && <div className="flex flex-wrap gap-2">
        <Link to={`/organizer/new?org=${org.id}&kind=${org.kind}`} className="inline-block rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">+ Create {org.kind === 'nonprofit' ? 'nonprofit' : org.kind === 'business' ? 'business' : 'an'} event</Link>
        {isLeadHere && <button onClick={() => setAdding(true)} className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800">+ Add an existing event</button>}
      </div>}
      {movedMsg && <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{movedMsg}</p>}
      {adding && <AddExistingEventsSheet orgId={org.id} orgName={org.name} onClose={() => setAdding(false)} onDone={(n) => { setAdding(false); setMovedMsg(n ? `Added ${n} event${n === 1 ? '' : 's'} to ${org.name}.` : 'Those events are already in an organization.'); reloadEvents(); }} />}
      {events.length === 0 ? !eventsLoaded ? <ListSkeleton rows={3} className="mt-3" /> : <p className="mt-4 text-sm text-muted">No events yet.</p> : (
        <ul className="mt-4 flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id}><Link to={`/organizer/events/${e.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface p-3 hover:border-[#C9A227]">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-bone">{e.title}</span><span className="text-xs text-muted">{e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'} · {e.status}{e.is_test ? ' · TEST' : ''}</span>{insights && attendance[e.id] && <span className="block text-xs text-muted">👥 {attendance[e.id].tickets} attending{attendance[e.id].checked_in ? ` · ${attendance[e.id].checked_in} checked in` : ''}</span>}</span>
              <span className="text-[#C9A227]">&rarr;</span>
            </Link></li>
          ))}
        </ul>
      )}
      {insights && <Link to={`?tab=Audience`} onClick={(e) => { e.preventDefault(); onAudience?.(); }} className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-surface p-3 text-sm"><span><strong className="text-bone">👥 Everyone who's attended</strong><span className="block text-muted">See your whole audience, attendance history and export in the Audience tab.</span></span><span className="shrink-0 font-semibold text-marigold">Open ›</span></Link>}
    </div>
  );
}

function DangerZone({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-10 rounded-2xl border border-red-200 p-4">
      <p className="font-semibold text-red-700">Delete organization</p>
      <p className="mt-1 text-sm text-muted">Hides the organization right away. You can restore it for 30 days; after that it's removed for good. Past events and donation records are kept.</p>
      <button onClick={() => setOpen(true)} className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700">Delete organization…</button>
      {open && <DeleteOrgSheet orgId={orgId} orgName={orgName} onClose={() => setOpen(false)} />}
    </section>
  );
}
