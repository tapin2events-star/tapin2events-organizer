export type Stage = 'watching' | 'reach_out' | 'in_talks' | 'confirmed' | 'passed';
export const STAGES: { key: Stage; label: string; hint: string; color: string }[] = [
  { key: 'watching', label: 'Watching', hint: 'On your radar', color: 'bg-gray-100 text-gray-700' },
  { key: 'reach_out', label: 'Reach out', hint: 'Ready to contact', color: 'bg-sky-100 text-sky-800' },
  { key: 'in_talks', label: 'In talks', hint: 'Booking or invite sent', color: 'bg-amber-100 text-amber-800' },
  { key: 'confirmed', label: 'Confirmed', hint: "They're in", color: 'bg-green-100 text-green-800' },
  { key: 'passed', label: 'Passed', hint: 'Not this time', color: 'bg-gray-100 text-gray-400' },
];
export const stageInfo = (s: Stage) => STAGES.find((x) => x.key === s) ?? STAGES[0];

export interface Board { id: string; name: string; description: string | null; owner_email: string }
export interface MyBoard { id: string; name: string; owner_email: string; owner_name: string | null; is_owner: boolean; card_count: number; member_count: number }
export interface Show { id: string; board_id: string; name: string; target_date: string | null; event_id: string | null; sort_order: number }
export interface Card {
  id: string; board_id: string; resource_id: string | null; outside_name: string | null; outside_link: string | null;
  notes: string | null; rating: number | null; tags: string[]; stage: Stage; show_id: string | null; booking_id: string | null;
  added_by: string | null; created_at: string;
}
export interface CardResource { id: string; display_name: string; profile_image: string | null; categories: string[] | null; kind: string | null; city: string | null }
