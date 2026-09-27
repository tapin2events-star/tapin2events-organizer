// Tracking page for common carriers (null if the carrier isn't recognized).
export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  const n = (number ?? '').trim();
  if (!n) return null;
  const c = (carrier ?? '').toLowerCase();
  const q = encodeURIComponent(n);
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${q}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${q}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${q}`;
  if (c.includes('dhl')) return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${q}`;
  return null;
}
