import type { Role } from './setup';

// "Show me" walkthroughs: each step can open a page (go), then highlights a real element (target, any of a few
// selectors; the first visible one is used) and explains it in one sentence. "click" steps move on when the person
// taps the highlighted element; "next" steps use the Next button. Missing elements never block: the card stays up.
export interface TourStep { go?: string; target: string; text: string; advance: 'click' | 'next' }
export interface Tour { id: string; role: Role; title: string; summary: string; steps: TourStep[] }

export const TOURS: Tour[] = [
  { id: 'events-get', role: 'attendee', title: 'Find an event and get tickets', summary: 'Search, open an event, and get your tickets', steps: [
    { go: '/', target: '[data-tour="discover-search"]', text: 'Search for events by name, place or type. Or just scroll down to browse what\u2019s near you.', advance: 'next' },
    { target: '[data-tour="event-card"]', text: 'Tap any event to see its details.', advance: 'click' },
    { target: '[data-tour="get-tickets"]', text: 'This is where you get tickets. Choose how many, then tap the button. Your tickets are saved in Activity.', advance: 'next' },
  ] },
  { id: 'events-tickets', role: 'attendee', title: 'Show your ticket at the door', summary: 'Find your QR code and send a ticket to a friend', steps: [
    { target: '[data-tour="nav-activity"], [data-tour="menu-activity"]', text: 'Tap Activity to see all your tickets.', advance: 'click' },
    { target: '[data-tour="ticket-link"]', text: 'Tap View ticket to open your QR code. Show it at the door, and they\u2019ll scan you in.', advance: 'click' },
    { target: '[data-tour="ticket-transfer"]', text: 'Buying for a friend, or can\u2019t make it? Send this ticket to someone here.', advance: 'next' },
  ] },
  { id: 'artist-profile', role: 'artist', title: 'Create your artist profile', summary: 'Get found and booked by organizers', steps: [
    { go: '/profile', target: '[data-tour="artist-turn-on"], [data-tour="artist-edit"]', text: 'This is your artist profile. Tap here to set it up (or edit it).', advance: 'click' },
    { target: '[data-tour="artist-name"]', text: 'Start with the name people know you by.', advance: 'next' },
    { target: '[data-tour="artist-save"]', text: 'Add what you do, photos and your rates, then save. Organizers can now find and book you.', advance: 'next' },
  ] },
  { id: 'artist-paid', role: 'artist', title: 'Get booked and get paid', summary: 'Booking requests and connecting payouts', steps: [
    { go: '/resources/dashboard', target: '[data-tour="rtab-Bookings"]', text: 'Booking requests from organizers show up here. You can accept, decline or send a counter-offer.', advance: 'next' },
    { go: '/profile', target: '[data-tour="payouts"]', text: 'Connect payouts once so TapIN can send your money: bookings, your share of ticket sales, and promo commission.', advance: 'next' },
  ] },
  { id: 'organizer-create', role: 'organizer', title: 'Create your first event', summary: 'Name, date, tickets, then publish', steps: [
    { go: '/organizer/new', target: '[data-tour="event-title"]', text: 'Start with your event\u2019s name.', advance: 'next' },
    { target: '[data-tour="event-next"]', text: 'Fill in each step, then tap Next to keep going. You can always come back and change things.', advance: 'click' },
    { target: '[data-tour="event-date"]', text: 'Set when your event starts and ends.', advance: 'next' },
    { target: '[data-tour="event-save"], [data-tour="event-next"]', text: 'Keep tapping Next through the steps. At the end, save: your event starts as a draft only you can see, then you publish it.', advance: 'next' },
  ] },
  { id: 'organizer-manage', role: 'organizer', title: 'Manage your event', summary: 'See who\u2019s coming, check people in, share', steps: [
    { go: '/organizer', target: '[data-tour="dashboard-event"]', text: 'These are your events. Tap Manage to open one.', advance: 'click' },
    { target: '[data-tour="tab-Attendees"]', text: 'Attendees shows everyone coming, with their tickets.', advance: 'click' },
    { target: '[data-tour="checkin"]', text: 'On event day, open Check-in to scan tickets at the door.', advance: 'next' },
    { target: '[data-tour="tab-Promote"]', text: 'Promote gives you links to share and shows which ones sell tickets.', advance: 'next' },
  ] },
  { id: 'org-setup', role: 'organization', title: 'Set up your organization', summary: 'A page for your group or business', steps: [
    { go: '/business', target: '#create-org, [data-tour="org-manage-link"]', text: 'Create your organization here with its name and type. Then add your logo and colors in its settings.', advance: 'next' },
  ] },
  { id: 'org-manage', role: 'organization', title: 'Run your organization', summary: 'Your page, team and audience', steps: [
    { go: 'org', target: '[data-tour="otab-Page"]', text: 'Page: your logo, colors, featured artists, videos and photos.', advance: 'next' },
    { target: '[data-tour="otab-Team"]', text: 'Team: invite people and choose what each person can do.', advance: 'next' },
    { target: '[data-tour="otab-Audience"]', text: 'Audience: everyone connected to you (attendees, followers, volunteers and donors), ready to message or export.', advance: 'next' },
  ] },
];
export const ROLE_TITLES: Record<Role, string> = { attendee: '🎟️ Going to events', artist: '🎤 Artists & performers', services: '🛠️ Services', organizer: '📅 Organizing events', organization: '🏢 Organizations' };
export const tourById = (id: string) => TOURS.find((t) => t.id === id);
