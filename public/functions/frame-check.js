// Can this website be shown inside TapIN's website viewer? Many sites refuse to be displayed inside other sites
// (X-Frame-Options or a Content-Security-Policy frame-ancestors rule). TapIN checks first, so the viewer shows the
// site when it can, and an "Open in browser" button (never a blank screen) when it can't.
//   GET /frame-check?url=https://example.com  ->  { embeddable: true|false, url: <final https url> }
const ok = (body, maxAge = 3600) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${maxAge}` },
});
export async function onRequestGet({ request }) {
  const target = new URL(request.url).searchParams.get('url') || '';
  let u;
  try { u = new URL(target); } catch { return ok({ embeddable: false }, 60); }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) return ok({ embeddable: false }, 60);
  // TapIN is served over https, so only https pages can be shown inside it.
  u.protocol = 'https:';
  try {
    const res = await fetch(u.toString(), { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; TapIN link viewer)' }, cf: { cacheTtl: 3600 } });
    const finalUrl = res.url || u.toString();
    if (!finalUrl.startsWith('https:')) return ok({ embeddable: false, url: finalUrl });
    const xfo = (res.headers.get('x-frame-options') || '').toLowerCase();
    if (xfo.includes('deny') || xfo.includes('sameorigin')) return ok({ embeddable: false, url: finalUrl });
    const csp = (res.headers.get('content-security-policy') || '').toLowerCase();
    const fa = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('frame-ancestors'));
    if (fa && !/(^|\s)\*(\s|$)/.test(fa.slice('frame-ancestors'.length)) && !fa.includes('tapin2events.com') && !fa.includes('https:')) {
      return ok({ embeddable: false, url: finalUrl });
    }
    return ok({ embeddable: res.status < 400, url: finalUrl });
  } catch {
    return ok({ embeddable: false }, 300);
  }
}
