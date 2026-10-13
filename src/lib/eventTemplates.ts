// Event templates: a starting point for common events. Picking one fills in the event type,
// category, description, ticket setup, registration questions and (for business and nonprofit
// events) a timed agenda. Everything stays editable. Preview feature: 'templates'.

export type TemplateKind = 'community' | 'business' | 'nonprofit';
export interface TemplateTier { name: string; price: string; quantity?: string; description?: string }
export interface TemplateSection { name: string; price: number; num_tables: number; seats_per_table: number; color: string }
export interface TemplateQuestion { label: string; kind: 'short_text' | 'long_text' | 'single_choice' | 'multi_choice' | 'yes_no'; options?: string[]; required?: boolean; help?: string }
export interface TemplateSession { title: string; kind: 'keynote' | 'session' | 'panel' | 'workshop' | 'networking' | 'break' | 'meal' | 'other'; offsetMin: number; durationMin: number }

export interface EventTemplate {
  id: string; name: string; icon: string; blurb: string;
  kind: TemplateKind; category: string;
  title: string; description: string;
  startHour: number; durationHours: number;
  sell: { mode: 'single'; price: string } | { mode: 'tiers'; tiers: TemplateTier[] } | { mode: 'seating'; sections: TemplateSection[] };
  capacity?: string;
  questions?: TemplateQuestion[];
  agenda?: TemplateSession[];
  donations?: { goal: string; pitch: string; presets: string };
}

const COMPANY: TemplateQuestion = { label: 'Company or organization', kind: 'short_text' };
const JOB: TemplateQuestion = { label: 'Job title', kind: 'short_text' };
const DIET: TemplateQuestion = { label: 'Dietary needs', kind: 'single_choice', options: ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Halal', 'Kosher', 'Other'] };

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'conference', name: 'Conference', icon: '🎤', blurb: 'Full-day program with keynotes, panels and workshops',
    kind: 'business', category: 'Business', title: 'Annual Conference',
    description: 'Join industry leaders, innovators and peers for a full day of keynotes, panel discussions and hands-on workshops.\n\nWhat to expect:\n• Inspiring keynote speakers\n• Panels on the trends shaping our field\n• Breakout workshops you can put to work right away\n• Networking reception to close the day\n\nBreakfast, lunch and the evening reception are included with your ticket.',
    startHour: 8, durationHours: 9,
    sell: { mode: 'tiers', tiers: [
      { name: 'Early Bird', price: '99', quantity: '50', description: 'Limited early pricing' },
      { name: 'General Admission', price: '149' },
      { name: 'VIP', price: '299', quantity: '25', description: 'Reserved seating, speaker meet & greet' },
    ] },
    capacity: '250',
    questions: [COMPANY, JOB, DIET],
    agenda: [
      { title: 'Check-in & breakfast', kind: 'meal', offsetMin: 0, durationMin: 60 },
      { title: 'Opening keynote', kind: 'keynote', offsetMin: 60, durationMin: 45 },
      { title: 'Panel discussion', kind: 'panel', offsetMin: 105, durationMin: 60 },
      { title: 'Lunch & networking', kind: 'meal', offsetMin: 180, durationMin: 60 },
      { title: 'Breakout workshops', kind: 'workshop', offsetMin: 240, durationMin: 90 },
      { title: 'Closing keynote', kind: 'keynote', offsetMin: 345, durationMin: 45 },
      { title: 'Networking reception', kind: 'networking', offsetMin: 420, durationMin: 120 },
    ],
  },
  {
    id: 'summit', name: 'Summit', icon: '🏔️', blurb: 'Half-day leadership gathering with conversations and roundtables',
    kind: 'business', category: 'Business', title: 'Leadership Summit',
    description: 'A focused half-day summit bringing together leaders to share ideas, challenges and what\u2019s next.\n\nThe program includes a fireside chat, an expert panel and small-group roundtables, followed by a reception.',
    startHour: 13, durationHours: 5,
    sell: { mode: 'tiers', tiers: [
      { name: 'General Admission', price: '79' },
      { name: 'Student', price: '25', description: 'Valid student ID required at check-in' },
    ] },
    capacity: '120',
    questions: [COMPANY, JOB, { label: 'What topic would you most like discussed?', kind: 'long_text' }],
    agenda: [
      { title: 'Welcome & opening remarks', kind: 'session', offsetMin: 0, durationMin: 20 },
      { title: 'Fireside chat', kind: 'keynote', offsetMin: 20, durationMin: 45 },
      { title: 'Expert panel', kind: 'panel', offsetMin: 75, durationMin: 60 },
      { title: 'Break', kind: 'break', offsetMin: 135, durationMin: 15 },
      { title: 'Roundtable discussions', kind: 'workshop', offsetMin: 150, durationMin: 60 },
      { title: 'Reception', kind: 'networking', offsetMin: 210, durationMin: 90 },
    ],
  },
  {
    id: 'gala', name: 'Gala', icon: '🥂', blurb: 'Seated dinner with a program, paddle raise and dancing',
    kind: 'nonprofit', category: 'Community', title: 'Annual Gala',
    description: 'Celebrate our community and support our mission at an evening of dinner, music and inspiration.\n\nThe evening includes a cocktail hour, a seated dinner and program, a paddle raise for our work, and dancing.\n\nDress code: cocktail attire.',
    startHour: 18, durationHours: 5,
    sell: { mode: 'seating', sections: [
      { name: 'Dinner seating', price: 150, num_tables: 10, seats_per_table: 8, color: '#4F46E5' },
      { name: 'VIP tables', price: 250, num_tables: 2, seats_per_table: 8, color: '#D97706' },
    ] },
    questions: [DIET, { label: 'Names of your guests (if buying for others)', kind: 'long_text' }],
    agenda: [
      { title: 'Cocktail hour', kind: 'networking', offsetMin: 0, durationMin: 60 },
      { title: 'Dinner & program', kind: 'meal', offsetMin: 60, durationMin: 90 },
      { title: 'Paddle raise', kind: 'session', offsetMin: 150, durationMin: 30 },
      { title: 'Music & dancing', kind: 'other', offsetMin: 180, durationMin: 120 },
    ],
    donations: { goal: '25000', pitch: 'Every gift tonight helps us expand our programs and reach more people in our community.', presets: '50, 100, 250, 500' },
  },
  {
    id: 'workshop', name: 'Workshop series', icon: '🛠️', blurb: 'Small hands-on class with limited spots',
    kind: 'business', category: 'Business', title: 'Hands-on Workshop',
    description: 'A small, hands-on workshop where you\u2019ll learn by doing. Spots are limited so everyone gets personal attention.\n\nBring a laptop and your questions. All materials are provided.',
    startHour: 18, durationHours: 2,
    sell: { mode: 'single', price: '35' },
    capacity: '25',
    questions: [
      { label: 'Your experience level', kind: 'single_choice', options: ['Beginner', 'Intermediate', 'Advanced'], required: true },
      { label: 'What do you hope to learn?', kind: 'long_text' },
    ],
    agenda: [
      { title: 'Introductions', kind: 'session', offsetMin: 0, durationMin: 15 },
      { title: 'Hands-on session', kind: 'workshop', offsetMin: 15, durationMin: 75 },
      { title: 'Q&A and next steps', kind: 'session', offsetMin: 90, durationMin: 30 },
    ],
  },
  {
    id: 'networking', name: 'Networking night', icon: '🤝', blurb: 'Casual mixer with speed networking',
    kind: 'business', category: 'Business', title: 'Networking Night',
    description: 'Meet professionals, founders and creatives over drinks and conversation. We\u2019ll kick things off with a quick round of speed networking, then the floor is yours.',
    startHour: 18, durationHours: 3,
    sell: { mode: 'single', price: '15' },
    capacity: '100',
    questions: [COMPANY, JOB, { label: 'What are you looking for?', kind: 'multi_choice', options: ['Hiring', 'A new role', 'Partners', 'Clients', 'Mentors', 'Just networking'] }],
    agenda: [
      { title: 'Arrivals & drinks', kind: 'networking', offsetMin: 0, durationMin: 30 },
      { title: 'Speed networking', kind: 'networking', offsetMin: 30, durationMin: 45 },
      { title: 'Open networking', kind: 'networking', offsetMin: 75, durationMin: 105 },
    ],
  },
  {
    id: 'fundraiser', name: 'Fundraiser', icon: '💛', blurb: 'Supporter tickets with a donation goal',
    kind: 'nonprofit', category: 'Community', title: 'Community Fundraiser',
    description: 'Join us for an evening that brings our community together and raises support for our mission. Every ticket and gift makes a real difference.',
    startHour: 18, durationHours: 3,
    sell: { mode: 'tiers', tiers: [
      { name: 'Supporter', price: '25' },
      { name: 'Champion', price: '100', description: 'Includes recognition in the program' },
    ] },
    capacity: '150',
    agenda: [
      { title: 'Welcome', kind: 'session', offsetMin: 0, durationMin: 30 },
      { title: 'Program & stories', kind: 'session', offsetMin: 30, durationMin: 60 },
      { title: 'Thank you & celebration', kind: 'networking', offsetMin: 90, durationMin: 90 },
    ],
    donations: { goal: '10000', pitch: 'Your gift goes directly to our programs and the people we serve.', presets: '25, 50, 100, 250' },
  },
  {
    id: 'showcase', name: 'Concert / showcase', icon: '🎶', blurb: 'Live music or art showcase with early bird pricing',
    kind: 'community', category: 'Music', title: 'Live Showcase',
    description: 'An unforgettable night of live performances from some of the area\u2019s best artists. Grab your tickets early, these go fast!',
    startHour: 19, durationHours: 4,
    sell: { mode: 'tiers', tiers: [
      { name: 'Early Bird', price: '15', quantity: '50' },
      { name: 'General Admission', price: '20' },
      { name: 'VIP', price: '40', quantity: '20', description: 'Early entry and reserved area' },
    ] },
    capacity: '200',
  },
  {
    id: 'open_mic', name: 'Open mic', icon: '🎙️', blurb: 'Free community night with performer sign-ups',
    kind: 'community', category: 'Arts & Culture', title: 'Open Mic Night',
    description: 'Poets, singers, comedians and storytellers: the stage is yours! Come to perform or come to cheer. Sign up when you register to grab a performance slot.',
    startHour: 19, durationHours: 3,
    sell: { mode: 'single', price: '0' },
    capacity: '80',
    questions: [
      { label: 'Do you want to perform?', kind: 'yes_no', required: true },
      { label: 'Your stage name and what you\u2019ll perform', kind: 'short_text', help: 'Only if you\u2019re performing' },
    ],
  },
];
