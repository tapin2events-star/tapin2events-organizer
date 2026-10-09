// Interest groups power "Picked for you" on Discover. Event categories in the
// database are a mix of the new app's categories ("Music"), the original
// app's ("entertainment", "art"), and ones organizers typed ("Open Mic"), so
// everything is mapped into these groups by keyword instead of exact match.

export const INTEREST_GROUPS = [
  { id: 'Music', emoji: '🎵' },
  { id: 'Arts & Culture', emoji: '🎨' },
  { id: 'Entertainment & Nightlife', emoji: '🎉' },
  { id: 'Food & Drink', emoji: '🍽️' },
  { id: 'Community', emoji: '🤝' },
  { id: 'Health & Fitness', emoji: '💪' },
  { id: 'Business & Tech', emoji: '💼' },
] as const;

export type InterestGroup = (typeof INTEREST_GROUPS)[number]['id'];

const RULES: [RegExp, InterestGroup[]][] = [
  [/\bopen mic\b/, ['Music', 'Arts & Culture']],
  [/\bfestival\b|\bfest\b/, ['Community', 'Music']],
  [/\bcomic ?con\b|\bcosplay\b|\bgaming\b|\btcg\b|\banime\b/, ['Entertainment & Nightlife', 'Arts & Culture']],
  [/\bmusic|concert|\bdj\b|hip ?hop|\br&b\b|jazz|gospel|\bband\b|live music|karaoke|singer|songwriter|choir|orchestra|rapper|\bbeats?\b/, ['Music']],
  [/\bart\b|\barts\b|artist|culture|theat(er|re)|poetry|poet|spoken word|\bslam\b|dance|film|museum|gallery|craft|makers?\b|paint|exhibit|photograph|storytell|\bbook\b|author/, ['Arts & Culture']],
  [/entertainment|nightlife|comedy|comedian|improv|stand-?up|party|\bclub\b|lounge|\bdrag\b|trivia|masquerade|\bgala\b|mixer|\bsocial\b|game night|happy hour|\bbar\b/, ['Entertainment & Nightlife']],
  [/\bfood|drink|dining|culinary|brunch|wine|beer|cocktail|\bbake|\bcook|tasting|food truck|\bmarket\b|farmers|\bsip\b/, ['Food & Drink']],
  [/community|worship|faith|church|ministry|volunteer|family|kids|juneteenth|block party|cleanup|library|vendor|pop-?up|fundrais|charity|neighborhood|celebration|heritage/, ['Community']],
  [/sport|fitness|health|wellness|yoga|\brun\b|running|\b5k\b|workout|\bspa\b|meditat|hike|hiking|cycling|basketball|football|soccer/, ['Health & Fitness']],
  [/business|\btech\b|technology|networking|career|startup|entrepreneur|conference|investor|marketing|leadership|professional/, ['Business & Tech']],
];

/** Interest groups a piece of text (an event category or title) belongs to. */
export function groupsFor(text: string | null | undefined): Set<InterestGroup> {
  const found = new Set<InterestGroup>();
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return found;
  for (const [re, groups] of RULES) if (re.test(t)) groups.forEach((g) => found.add(g));
  return found;
}

/** Normalizes stored interests (new group names or the original app's words like "art"). */
export function normalizeInterests(values: string[] | null | undefined): InterestGroup[] {
  const out = new Set<InterestGroup>();
  for (const v of values ?? []) {
    const exact = INTEREST_GROUPS.find((g) => g.id.toLowerCase() === String(v).toLowerCase());
    if (exact) out.add(exact.id);
    else groupsFor(String(v)).forEach((g) => out.add(g));
  }
  return INTEREST_GROUPS.map((g) => g.id).filter((g) => out.has(g));
}
