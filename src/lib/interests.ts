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
  [/\bfestival|fest\b/, ['Community', 'Music']],
  [/\bcomic ?con\b|\bcosplay\b|\bgaming\b|\btcg\b/, ['Entertainment & Nightlife', 'Arts & Culture']],
  [/\bmusic|concert|\bdj\b|hip ?hop|jazz|gospel|band\b|\blive music\b|karaoke/, ['Music']],
  [/\bart\b|\barts\b|culture|theat(er|re)|poetry|spoken word|dance|film|museum|gallery|craft|makers?\b/, ['Arts & Culture']],
  [/entertainment|nightlife|comedy|party|club\b|lounge|drag\b|trivia/, ['Entertainment & Nightlife']],
  [/\bfood|drink|dining|culinary|brunch|wine|beer|cocktail|bake|cook|taste|tasting|market\b/, ['Food & Drink']],
  [/community|worship|faith|church|ministry|volunteer|family|kids|juneteenth|block party|cleanup|education|school|library/, ['Community']],
  [/sport|fitness|health|wellness|yoga|\brun\b|running|5k|workout|spa\b/, ['Health & Fitness']],
  [/business|\btech|technology|networking|career|startup|entrepreneur|education|workshop|conference/, ['Business & Tech']],
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
