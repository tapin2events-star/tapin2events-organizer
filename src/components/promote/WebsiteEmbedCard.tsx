import { useState } from 'react';
import PremiumBadge from '../business/PremiumBadge';

const SITE = 'https://app.tapin2events.com';
// "Your website": copy a small code to show your organization on your own website: its full organization page, or just
// its events (list, grid or calendar). For one event: its ticket card.
export default function WebsiteEmbedCard({ orgSlug, eventId, title }: { orgSlug?: string; eventId?: string; title?: string }) {
  const [layout, setLayout] = useState<'list' | 'grid' | 'calendar'>('list');
  // Organizations: the full organization page (default), or events only.
  const [view, setView] = useState<'page' | 'events'>(eventId ? 'events' : 'page');
  const page = !eventId && view === 'page';
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [brand, setBrand] = useState(true);
  const [badge, setBadge] = useState(true);
  const [plain, setPlain] = useState(false);
  const [copied, setCopied] = useState(false);
  const [help, setHelp] = useState<string | null>(null);
  const attrs = [eventId ? `data-event="${eventId}"` : `data-org="${orgSlug}"`, !eventId && layout !== 'list' ? `data-layout="${layout}"` : '', theme === 'dark' ? 'data-theme="dark"' : '', brand ? 'data-brand="1"' : '', !badge ? 'data-badge="0"' : ''].filter(Boolean).join(' ');
  const qs = [!eventId && layout !== 'list' ? `layout=${layout}` : '', theme === 'dark' ? 'theme=dark' : '', brand ? 'brand=1' : '', !badge ? 'badge=0' : ''].filter(Boolean).join('&');
  const src = page ? `${SITE}/embed/page/${orgSlug}` : `${SITE}${eventId ? `/embed/event/${eventId}` : `/embed/org/${orgSlug}`}${qs ? `?${qs}` : ''}`;
  const code = page
    ? (plain
      ? `<iframe src="${src}" style="width:100%;border:0;min-height:900px" loading="lazy" title="Organization page"></iframe>`
      : `<div class="tapin-events" data-org="${orgSlug}" data-view="page"></div>\n<script src="${SITE}/embed.js" async></script>`)
    : plain
    ? `<iframe src="${src}" style="width:100%;border:0;min-height:${eventId ? 420 : 520}px" loading="lazy" title="${eventId ? 'Get tickets' : 'Upcoming events'}"></iframe>`
    : `<div class="tapin-events" ${attrs}></div>\n<script src="${SITE}/embed.js" async></script>`;
  const previewSrc = page ? `/embed/page/${orgSlug}` : `${eventId ? `/embed/event/${eventId}` : `/embed/org/${orgSlug}`}?${qs}`;
  const seg = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`;
  const HELP: Record<string, string[]> = {
    WordPress: ['Edit the page where you want your events.', 'Add a block (+) and choose "Custom HTML".', 'Paste the code and update the page.'],
    Squarespace: ['Edit the page and add a block.', 'Choose "Code" and paste the code.', 'Save. (Code blocks need a Business plan or higher on Squarespace; otherwise use the "Plain frame" version with an Embed block.)'],
    Wix: ['In the editor, click Add (+) > Embed Code > Embed HTML.', 'Choose "Code", paste it, and resize the box.', 'Publish your site.'],
    'Other sites': ['Find the option to add "HTML", "embed" or "code" to a page.', 'Paste the code there.', 'If your site doesn\u2019t allow scripts, switch to "Plain frame" and paste that instead.'],
  };
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4">
      <p className="font-semibold text-bone">🌐 {eventId ? 'Add this event to your website' : 'Show your organization on your website'}</p>
      <p className="text-sm text-muted">{eventId ? `Paste this once and visitors can get tickets for ${title ?? 'this event'} right from your site.` : (page ? 'Paste this once and your organization page shows up on your website, always up to date.' : 'Paste this once and every event you publish on TapIN shows up on your website automatically.')} Sales from your website show in your Promote stats as "Website."</p>
      {!eventId && (
        <div className="mt-3 flex gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="What to show">
          <button role="radio" aria-checked={view === 'page'} onClick={() => setView('page')} className={`flex-1 ${seg(view === 'page')}`}>Full organization page</button>
          <button role="radio" aria-checked={view === 'events'} onClick={() => setView('events')} className={`flex-1 ${seg(view === 'events')}`}>Events only</button>
        </div>
      )}
      {page && <p className="mt-2 text-sm text-gray-600">Your whole TapIN organization page (cover, about, events, team, photos and more) right on your website, in your brand. It updates automatically whenever you change it on TapIN.</p>}
      {!page && <>
      <div className="mt-3 flex flex-wrap gap-2">
        {!eventId && <div className="flex gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Layout">{(['list', 'grid', 'calendar'] as const).map((l) => <button key={l} role="radio" aria-checked={layout === l} onClick={() => setLayout(l)} className={seg(layout === l)}>{l === 'list' ? 'List' : l === 'grid' ? 'Grid' : 'By month'}</button>)}</div>}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Background">{(['light', 'dark'] as const).map((t) => <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)} className={seg(theme === t)}>{t === 'light' ? 'Light site' : 'Dark site'}</button>)}</div>
      </div>
      <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
        <label className="flex items-center gap-2"><input type="checkbox" checked={brand} onChange={(e) => setBrand(e.target.checked)} className="h-4 w-4 accent-marigold" /> Use my brand colors and font <PremiumBadge feature="embed_polish" /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!badge} onChange={(e) => setBadge(!e.target.checked)} className="h-4 w-4 accent-marigold" /> Hide "Tickets by TapIN" <PremiumBadge feature="embed_polish" /></label>
      </div>
      </>}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
      <div className={`mt-1.5 max-h-[420px] overflow-auto rounded-xl border border-gray-200 p-2 ${theme === 'dark' && !page ? 'bg-gray-900' : 'bg-white'}`}>
        <iframe key={previewSrc} src={previewSrc} title="Preview" className={`${page ? 'h-[600px]' : 'h-[380px]'} w-full border-0`} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your code</p>
        <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={plain} onChange={(e) => setPlain(e.target.checked)} className="h-3.5 w-3.5 accent-marigold" /> Plain frame (for sites that block scripts)</label>
      </div>
      <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-gray-900 p-3 text-xs text-green-200">{code}</pre>
      <button onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* ignore */ } }} className="mt-2 rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">{copied ? '✓ Copied' : 'Copy code'}</button>
      <p className="mt-4 text-sm font-medium text-gray-800">How to add it</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{Object.keys(HELP).map((k) => <button key={k} onClick={() => setHelp(help === k ? null : k)} className={`rounded-full border px-3 py-1 text-xs font-medium ${help === k ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-300 text-gray-700'}`}>{k}</button>)}</div>
      {help && <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">{HELP[help].map((s) => <li key={s}>{s}</li>)}</ol>}
    </section>
  );
}
