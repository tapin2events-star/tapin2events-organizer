// In-app help: short, plain-language guides. "areas" decide which guides show first on each screen.
export type HelpArea = 'start' | 'attendee' | 'artist' | 'organizer' | 'organization' | 'payments';
export interface Guide { id: string; title: string; area: HelpArea; steps: string[]; link?: { to: string; label: string }; keywords?: string }

export const GUIDES: Guide[] = [
  // Getting started
  { id: 'find-events', area: 'start', title: 'Find events and get tickets', keywords: 'discover search buy register ticket',
    steps: ['Open Discover to see events near you. Use search, categories or the map.', 'Tap an event, then Get tickets (or Register for free events).', 'Your tickets live in My Activity. Show the QR code at the door.'], link: { to: '/', label: 'Go to Discover' } },
  { id: 'your-profile', area: 'start', title: 'Set up your profile', keywords: 'profile photo artist networking organization',
    steps: ['Open Profile and add a photo and short bio.', 'Under Your profile, turn on the parts you need: Artist & services, Networking card, Organizations or Organizing.', 'Tap View public profile to see what others see.'], link: { to: '/profile', label: 'Open my profile' } },
  { id: 'networking', area: 'attendee', title: 'Meet people at events', keywords: 'networking connect qr card',
    steps: ['On an event with networking, add a quick card: your title, company and what you\u2019re looking for.', 'Browse who\u2019s going and send connection requests, or scan each other\u2019s QR codes in person.', 'Your contact info is shared only when you both connect. Find everyone in People I\u2019ve met.'], link: { to: '/network', label: 'Open Networking' } },
  { id: 'follow', area: 'attendee', title: 'Follow organizations and artists', keywords: 'follow notifications new events',
    steps: ['Open an organization or artist page and tap Follow.', 'You\u2019ll hear about their new events first (you can change this in Settings > Notifications).'], link: { to: '/organizations', label: 'Browse organizations' } },
  { id: 'volunteer', area: 'attendee', title: 'Volunteer at an event', keywords: 'volunteer shift sign up waitlist',
    steps: ['On an event page, look for the Volunteer card.', 'Pick a shift and tap Sign up. If it\u2019s full, join the waitlist and you\u2019ll move up automatically.', 'You\u2019ll get a reminder the day before.'] },

  // Artists & services
  { id: 'artist-profile', area: 'artist', title: 'Create your artist or services profile', keywords: 'artist performer vendor resource profile booked',
    steps: ['Go to Profile > Your profile > Artist & services and tap Turn on.', 'Add your name, what you do, photos, rates and a short bio.', 'Organizers can now find and book you. Manage requests under Bookings & edit.'], link: { to: '/resources/new', label: 'Create my profile' } },
  { id: 'get-booked', area: 'artist', title: 'Get booked and handle requests', keywords: 'booking request offer accept counter',
    steps: ['Booking requests show up in your Artist & vendor dashboard and notifications.', 'Accept, decline or send a counter-offer.', 'Confirmed bookings and payments show in your dashboard, and you can message the organizer from there.'], link: { to: '/resources/dashboard', label: 'Open my bookings' } },
  { id: 'splits-performer', area: 'artist', title: 'Get your share of ticket sales', keywords: 'revenue split share performer paid automatically',
    steps: ['When an organizer adds you to an event\u2019s revenue split, you\u2019ll get an email.', 'Connect your payouts once (Profile > Settings > Payouts).', 'Your share of every ticket is sent automatically. Track it in Earnings.'], link: { to: '/organizer/earnings', label: 'See my earnings' } },
  { id: 'promo-links', area: 'artist', title: 'Earn with your promo link', keywords: 'promoter link commission share sell tickets',
    steps: ['Organizers can give you a personal ticket link with a commission (like 10%).', 'Share it everywhere you\u2019d post the flyer.', 'With automatic payouts on, your commission is sent on every ticket sold through your link. See it in My promoter links.'], link: { to: '/promoter', label: 'My promoter links' } },
  { id: 'shop', area: 'artist', title: 'Sell merch', keywords: 'shop product merch sell shipping pickup',
    steps: ['From your artist profile or an event, add products with photos, price and stock.', 'Choose shipping or pickup at events.', 'Orders show up in your dashboard; mark them shipped or ready for pickup.'], link: { to: '/products', label: 'Open Shop' } },

  // Organizers
  { id: 'create-event', area: 'organizer', title: 'Create and publish an event', keywords: 'create event publish draft template',
    steps: ['Tap Create event (or start from a template).', 'Add the title, date, place, photo and tickets. It saves as a draft that only your team can see.', 'When it looks right, tap Publish. Share the link or QR code.'], link: { to: '/organizer/new', label: 'Create an event' } },
  { id: 'tickets', area: 'organizer', title: 'Ticket types and promo codes', keywords: 'ticket type tier vip early bird promo code discount price',
    steps: ['On your event, open the Tickets tab.', 'Add ticket types (General, VIP, Early bird) with prices and limits.', 'Create promo codes for discounts. Buyers pay the fees on top, so you keep the full price.'] },
  { id: 'attendees', area: 'organizer', title: 'See who\u2019s coming and check people in', keywords: 'attendees check in scan door spreadsheet export',
    steps: ['The Attendees tab shows everyone, their tickets and answers.', 'Tap Check-in to scan tickets at the door.', 'Download one spreadsheet with everything.'] },
  { id: 'splits-organizer', area: 'organizer', title: 'Split ticket sales with performers', keywords: 'revenue split percentage performers partners payout',
    steps: ['On your event, open Sales > Revenue splits > Set up a split.', 'Find people by name and set each person\u2019s percentage. The rest goes to your payout account.', 'Everyone gets an email to connect payouts, and their share is sent on every sale.'] },
  { id: 'promoters', area: 'organizer', title: 'Promotion links and paying promoters', keywords: 'promote promoter link commission automatic payouts performers',
    steps: ['Open the Promote tab and tap + New link (for a place like Instagram, or for a promoter).', 'Use Give each performer a promo link to cover your whole lineup in one tap.', 'Turn on Pay promoters automatically to send commission on every ticket sold through their link.'] },
  { id: 'merch-checkout', area: 'organizer', title: 'Sell merch with tickets', keywords: 'merch add-on checkout products pickup',
    steps: ['On your event\u2019s Products tab, add items with pickup turned on.', 'They\u2019ll show as Add merch when people buy tickets.', 'Orders appear in your merch orders; hand them out at the event.'] },
  { id: 'team', area: 'organizer', title: 'Your team, volunteers and tasks', keywords: 'team roles tasks volunteers shifts helpers',
    steps: ['Team & tasks lets you invite co-organizers and helpers, and assign tasks.', 'Switch to Volunteers to create shifts people sign up for.', 'Planning shows what every event still needs.'] },
  { id: 'messages', area: 'organizer', title: 'Message your attendees', keywords: 'message email attendees update announcement',
    steps: ['Open the Messages tab on your event.', 'Write your update and send it to everyone with a ticket.', 'Changing the date or place notifies attendees automatically.'] },
  { id: 'program', area: 'organizer', title: 'Agenda, workshops and galas', keywords: 'program agenda speakers sponsors workshop sessions gala tables paddle',
    steps: ['Business and nonprofit events have a Program tab for the agenda, speakers, sponsors and FAQ.', 'Mark sessions as sign-up workshops with limited seats.', 'Galas get a Gala tab for table seating, paddle numbers and the paddle raise.'] },

  // Organizations
  { id: 'organization', area: 'organization', title: 'Create your organization', keywords: 'organization business nonprofit page create',
    steps: ['Go to TapIN for Business and create your organization.', 'Add your logo, colors and description in organization settings.', 'Host events as your organization so they appear on your page.'], link: { to: '/business', label: 'TapIN for Business' } },
  { id: 'org-team', area: 'organization', title: 'Organization team and roles', keywords: 'team roles owner admin editor members chat',
    steps: ['In organization settings > Team, invite people as Owner, Admin, Editor or Member.', 'Your team is added to the organization\u2019s events automatically.', 'Use team chat to plan together.'] },
  { id: 'org-page', area: 'organization', title: 'Your organization page', keywords: 'page artists speakers videos shop photos',
    steps: ['In organization settings > Page, feature your artists or speakers, videos, shop items and photos.', 'Your upcoming events show automatically.', 'Share your page link so people can follow you.'] },
  { id: 'audience', area: 'organization', title: 'Your audience', keywords: 'audience attendees followers volunteers donors export',
    steps: ['Organization settings > Audience shows everyone connected to you: attendees, followers, volunteers and donors.', 'Filter, search and export a spreadsheet.'] },
  { id: 'business-plan', area: 'organization', title: 'Plans and packs', keywords: 'business plan essentials packs agency premium price free founding',
    steps: ['Features marked \u2b50 are free during early access. Revenue splits are always free.', 'When paid plans begin: Essentials ($15/mo) with optional packs (Performers, Conference, Fundraising, Community), Business ($49/mo) with everything, or Agency ($149/mo) for up to 5 client organizations. One event can be unlocked for $199.', 'The first 20 founding organizations get 40% off Business or Agency for life, and Essentials price locked for life.'], link: { to: '/business/plan', label: 'See plans' } },

  // Payments
  { id: 'payouts', area: 'payments', title: 'Connect payouts and get paid', keywords: 'payouts stripe bank paid money',
    steps: ['Go to Profile > Settings > Payouts and connect with Stripe (a few minutes).', 'Ticket money, splits and commission are sent to your bank on Stripe\u2019s schedule.', 'Stripe keeps your bank details secure; TapIN never sees your account number.'], link: { to: '/profile', label: 'Open Payouts' } },
  { id: 'fees', area: 'payments', title: 'Fees and refunds', keywords: 'fees refund service processing cancel',
    steps: ['Buyers pay a service and processing fee on top of the ticket price, so organizers keep the full price.', 'Fees aren\u2019t refundable. If an organizer cancels, buyers are refunded the ticket price.', 'Questions about a refund? Contact the event\u2019s organizer from the event page.'], link: { to: '/refund-policy', label: 'Refund policy' } },
];

// Which areas fit the current screen, most relevant first.
export function areasFor(path: string): HelpArea[] {
  if (/^\/organizer\/events\//.test(path) || path === '/organizer' || path.startsWith('/organizer/new') || path.startsWith('/organizer/planning')) return ['organizer', 'payments'];
  if (/^\/business\/[^/]+\/manage/.test(path) || path.startsWith('/business')) return ['organization', 'organizer'];
  if (path.startsWith('/resources/dashboard') || path.startsWith('/resources/new') || path.startsWith('/groups') || path.startsWith('/promoter') || path.startsWith('/organizer/earnings')) return ['artist', 'payments'];
  if (path.startsWith('/profile')) return ['start', 'payments'];
  if (path.startsWith('/events/') || path.startsWith('/activity') || path.startsWith('/network') || path.startsWith('/connections')) return ['attendee', 'start'];
  return ['start', 'attendee'];
}
