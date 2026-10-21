// Missing app files (/assets/...) get a real "Not found" that browsers never save.
// Without this, Cloudflare answers a missing file with the app's main page, and because files under /assets/ are
// saved for a year, a browser that asked at the wrong moment would keep reusing that wrong answer.
export async function onRequest(context) {
  const res = await context.next();
  if ((res.headers.get('content-type') || '').includes('text/html')) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  }
  return res;
}
