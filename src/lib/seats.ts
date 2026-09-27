// Seat labels are stored as "<section>-T<table>-<seat>", e.g. "VIP-T2-3".

export function parseSeat(label: string | null | undefined): { table: string; seat: string } | null {
  const m = (label || '').match(/-T(\d+)-(\d+)$/);
  return m ? { table: m[1], seat: m[2] } : null;
}

/** "VIP · Table 2, Seat 3" */
export function seatText(section: string | null | undefined, label: string | null | undefined): string {
  const p = parseSeat(label);
  if (p) return `${section ? section + ' · ' : ''}Table ${p.table}, Seat ${p.seat}`;
  return [section, label].filter(Boolean).join(' · ');
}

/** Groups seats by section and table: [{ label: "VIP · Table 2", seats: ["1","2"] }] */
export function seatGroups(tickets: { section_name: string | null; seat_assignment: string | null }[]) {
  const groups = new Map<string, { label: string; seats: string[] }>();
  for (const t of tickets) {
    const p = parseSeat(t.seat_assignment);
    const section = t.section_name || '';
    const key = `${section}|${p?.table ?? ''}`;
    const label = [section, p ? `Table ${p.table}` : ''].filter(Boolean).join(' · ') || 'Seats';
    const g = groups.get(key) ?? { label, seats: [] };
    const seat = p ? p.seat : t.seat_assignment || '';
    if (seat) g.seats.push(seat);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, seats: g.seats.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)) }));
}
