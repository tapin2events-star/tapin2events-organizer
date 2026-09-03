// Predefined, selectable event features — organizers pick from this list
// rather than typing free text, keeping the data consistent for display.
export const AVAILABLE_FEATURES = [
  { icon: '🎵', title: 'Live Music', description: 'Live musical performances' },
  { icon: '✨', title: 'Family-Friendly', description: 'Fun and safe for all ages' },
  { icon: '🍕', title: 'Food & Catering', description: 'Delicious food options available' },
  { icon: '🍹', title: 'Bar & Beverages', description: 'Full bar and drink service' },
  { icon: '🅿️', title: 'Free Parking', description: 'Free parking available on-site' },
  { icon: '♿', title: 'Wheelchair Accessible', description: 'Accessible venue and facilities' },
  { icon: '🐾', title: 'Pet-Friendly', description: 'Well-behaved pets welcome' },
  { icon: '📸', title: 'Photography Allowed', description: 'Feel free to take photos and videos' },
  { icon: '🌳', title: 'Outdoor Venue', description: 'Held outdoors — dress accordingly' },
  { icon: '🎟️', title: 'VIP Options Available', description: 'Upgrade for a premium experience' },
];

export interface EventFeature {
  icon: string;
  title: string;
  description?: string;
}
