// Events whose tickets are sold on another site (Eventbrite, a venue's box
// office...). TapIN links out instead of running its own checkout.

const KNOWN: Record<string, string> = {
  'eventbrite.com': 'Eventbrite',
  'ticketmaster.com': 'Ticketmaster',
  'livenation.com': 'Live Nation',
  'etix.com': 'Etix',
  'axs.com': 'AXS',
  'dice.fm': 'DICE',
  'tixr.com': 'Tixr',
  'showclix.com': 'ShowClix',
  'seetickets.us': 'See Tickets',
  'universe.com': 'Universe',
  'ticketleap.events': 'TicketLeap',
  'zeffy.com': 'Zeffy',
  'givebutter.com': 'Givebutter',
  'partiful.com': 'Partiful',
  'lu.ma': 'Luma',
  'luma.com': 'Luma',
  'meetup.com': 'Meetup',
};

/** A friendly name for the ticket site, e.g. "Eventbrite" or "kingsbarcade.com". */
export function ticketSiteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^(www\.|m\.)/, '');
    const match = Object.keys(KNOWN).find((d) => host === d || host.endsWith('.' + d));
    return match ? KNOWN[match] : host;
  } catch {
    return 'the ticket site';
  }
}

/** Only http(s) links are ever used as ticket links. */
export function safeTicketUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
