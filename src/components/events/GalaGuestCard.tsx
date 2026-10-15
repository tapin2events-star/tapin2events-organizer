import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Event page (Preview): for ticket holders, their table and paddle number. Nothing shows for anyone else.
export default function GalaGuestCard({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<{ table: string | null; paddle: number | null } | null>(null);
  useEffect(() => {
    if (!user) { setInfo(null); return; }
    supabase.rpc('my_gala_info', { p_event_id: eventId }).then(({ data }) => setInfo((data ?? null) as typeof info));
  }, [eventId, user]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!info || (!info.table && !info.paddle)) return null;
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-900 to-gray-800 p-4 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/70">🥂 Your evening</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {info.table && <div><p className="text-[11px] uppercase tracking-wide text-white/60">Table</p><p className="text-2xl font-extrabold">{info.table}</p></div>}
        {info.paddle && <div className="border-l border-white/20 pl-3"><p className="text-[11px] uppercase tracking-wide text-white/60">Paddle</p><p className="text-2xl font-extrabold text-emerald-300">#{info.paddle}</p></div>}
      </div>
      <p className="mt-2 text-xs text-white/70">{info.paddle ? 'Raise your paddle number to bid or pledge during the program.' : 'See you there!'}</p>
    </section>
  );
}
