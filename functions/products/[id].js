// Link previews (Cloudflare Pages Function). The same code is in each route folder under public/functions; keep them in sync.
// Preview bots (iMessage, WhatsApp, Facebook, LinkedIn, Slack, X, Discord, search engines) get this page's own
// title, description and image; everyone else goes straight to the app with no extra work.
const SUPABASE = 'https://ylliuomglomfasbpvplt.supabase.co';
const KEY = 'sb_publishable_Qan-cOtUoOoVa_kSHYthvw_sMZW2ZN-'; // public key (same one the app uses)
const BOTS = /bot\b|crawler|spider|preview|facebookexternalhit|facebot|whatsapp|slack|discord|telegram|linkedin|twitter|pinterest|embedly|iframely|skype|vkshare|quora|redditbot|applebot|googlebot|bingbot|yandex|duckduck|snapchat|tiktok|instagram/i;
const KIND = 'product';
const PARAM = 'id';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const setContent = (val) => ({ element(e) { e.setAttribute('content', val); } });

export async function onRequest(context) {
  const ua = context.request.headers.get('user-agent') || '';
  if (context.request.method !== 'GET' || !BOTS.test(ua)) return context.next();
  const page = await context.next();
  let p = null;
  try {
    const key = decodeURIComponent(String(context.params[PARAM] || '')).slice(0, 200);
    const r = await fetch(`${SUPABASE}/rest/v1/rpc/link_preview`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_kind: KIND, p_key: key }),
    });
    if (r.ok) p = await r.json();
  } catch { /* fall back to the default preview */ }
  if (!p || !p.title) return page;
  const url = new URL(context.request.url);
  url.search = '';
  const ownImage = typeof p.image === 'string' && /^https:\/\//i.test(p.image) && !/\.(heic|heif)(\?|$)/i.test(p.image);
  const image = ownImage ? p.image : `${url.origin}/og-default.png`;
  const title = String(p.title).slice(0, 120);
  const description = String(p.description || '').slice(0, 300) || 'Find events, get tickets, and discover what\u2019s happening near you.';
  const site = p.site_name || 'TapIN2Events';
  const out = new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(`${title} \u00b7 ${site}`); } })
    .on('meta[name="description"]', setContent(description))
    .on('meta[property="og:site_name"]', setContent(site))
    .on('meta[property="og:type"]', setContent(p.type === 'event' ? 'article' : p.type === 'product' ? 'product' : 'profile'))
    .on('meta[property="og:title"]', setContent(title))
    .on('meta[property="og:description"]', setContent(description))
    .on('meta[property="og:image"]', setContent(image))
    .on('meta[property="og:image:width"]', { element(e) { if (ownImage) e.remove(); } })
    .on('meta[property="og:image:height"]', { element(e) { if (ownImage) e.remove(); } })
    .on('meta[name="twitter:title"]', setContent(title))
    .on('meta[name="twitter:description"]', setContent(description))
    .on('meta[name="twitter:image"]', setContent(image))
    .on('head', { element(e) { e.append(`<meta property="og:url" content="${esc(url.href)}" /><link rel="canonical" href="${esc(url.href)}" />`, { html: true }); } })
    .transform(page);
  const res = new Response(out.body, out);
  res.headers.set('Cache-Control', 'public, max-age=300');
  return res;
}
