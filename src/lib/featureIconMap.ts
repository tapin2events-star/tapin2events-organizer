// Some events were migrated from the original app with feature icons stored
// as plain icon-name strings (e.g. "music", "parking") rather than emoji --
// those names were meant to look up an icon in a component library that
// doesn't exist here, so they'd otherwise render as literal text. This maps
// the known legacy names to an equivalent emoji.
const LEGACY_ICON_NAME_MAP: Record<string, string> = {
  accessibility: '♿',
  community: '🤝',
  drinks: '🍹',
  food: '🍕',
  indoor: '🏠',
  'map-pin': '📍',
  merchandise: '👕',
  mic: '🎤',
  music: '🎵',
  networking: '🤝',
  outdoor: '🌳',
  parking: '🅿️',
  prizes: '🎁',
  star: '⭐',
  theater: '🎭',
  ticket: '🎟️',
  users: '👥',
  wifi: '📶',
  workshops: '📚',
};

export function resolveFeatureIcon(icon: string): string {
  return LEGACY_ICON_NAME_MAP[icon] ?? icon;
}
