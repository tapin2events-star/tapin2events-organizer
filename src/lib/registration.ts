import { supabase } from './supabaseClient';

export type QuestionKind = 'short_text' | 'long_text' | 'single_choice' | 'multi_choice' | 'yes_no' | 'email' | 'phone' | 'number';
export interface Question { id: string; event_id: string; label: string; help: string | null; kind: QuestionKind; options: string[]; required: boolean; sort_order: number; active: boolean }
export interface MyRequest { id: string; status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'; message: string | null; decision_note: string | null; created_at: string }
export type Answers = Record<string, string | string[]>;

export const KIND_LABEL: Record<QuestionKind, string> = {
  short_text: 'Short answer', long_text: 'Paragraph', single_choice: 'Multiple choice (pick one)', multi_choice: 'Checkboxes (pick any)',
  yes_no: 'Yes / No', email: 'Email', phone: 'Phone', number: 'Number',
};

export async function loadQuestions(eventId: string, includeHidden = false): Promise<Question[]> {
  let q = supabase.from('event_questions').select('*').eq('event_id', eventId).order('sort_order').order('created_at');
  if (!includeHidden) q = q.eq('active', true);
  const { data } = await q;
  return (data ?? []) as Question[];
}

export async function loadMyAnswers(eventId: string, email: string): Promise<Answers> {
  const { data } = await supabase.from('registration_answers').select('question_id, answer').eq('event_id', eventId).ilike('user_email', email);
  const out: Answers = {};
  (data ?? []).forEach((r) => { out[r.question_id as string] = r.answer as string | string[]; });
  return out;
}

export async function loadMyRequest(eventId: string, email: string): Promise<MyRequest | null> {
  const { data } = await supabase.from('registration_requests').select('id, status, message, decision_note, created_at')
    .eq('event_id', eventId).ilike('user_email', email).order('created_at', { ascending: false }).limit(1);
  return ((data ?? [])[0] as MyRequest) ?? null;
}

export function answerText(a: unknown): string {
  if (Array.isArray(a)) return a.join(', ');
  if (a === 'yes') return 'Yes';
  if (a === 'no') return 'No';
  return a == null ? '' : String(a);
}
