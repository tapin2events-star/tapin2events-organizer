// "Invite a local partner": the ready-to-send ask, written from the event's details.
export interface InviteView {
  business_name: string; status: string; perk: string | null; perk_details: string | null; partner_id: string | null;
  event: { id: string; title: string; start_date: string | null; location: string | null; poster: string | null; published: boolean; guests: number; capacity: number | null };
  host: string | null; distance_m: number | null;
}
export const inviteLink = (token: string) => `https://app.tapin2events.com/partner/${token}`;
export const eventDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'an upcoming date');
const walk = (m: number | null) => (m == null ? '' : m < 120 ? ', right next door to you' : `, just a ${Math.max(1, Math.round(m / 80))}-minute walk from you`);
const crowd = (v: InviteView) => {
  if (v.event.guests >= 20) return `We already have ${v.event.guests} guests coming`;
  if (v.event.capacity && v.event.capacity >= 20) return `We're expecting up to ${v.event.capacity} guests`;
  return 'We\u2019re expecting a great crowd';
};
export function buildPitch(v: InviteView, token: string, sender: string) {
  return `Hi ${v.business_name}! I'm ${sender}${v.host && v.host !== sender ? ` with ${v.host}` : ''}. We're hosting ${v.event.title} at ${v.event.location || 'a venue nearby'} on ${eventDay(v.event.start_date)}${walk(v.distance_m)}. ${crowd(v)}.

Would you like to offer our ticket holders a perk, like 10% off or a free drink before the show? It's free for you: your business is featured on our event page and on every guest's ticket, and guests just show their ticket at your counter.

You can say yes and choose your perk here (takes a minute): ${inviteLink(token)}`;
}
