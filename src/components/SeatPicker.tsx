interface SeatPickerProps {
  section: { name: string; price: number; num_tables: number; seats_per_table: number; color: string };
  bookedSeats: string[];
  selectedSeats: string[];
  onToggleSeat: (seatLabel: string) => void;
}

export default function SeatPicker({ section, bookedSeats, selectedSeats, onToggleSeat }: SeatPickerProps) {
  const tables = Array.from({ length: section.num_tables }, (_, i) => i + 1);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: section.color }} />
          {section.name}
        </span>
        <span className="text-sm text-gray-300">${section.price}/seat</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gray-600" /> Available</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-mint" /> Selected</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-magenta" /> Taken</span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {tables.map((table) => (
          <div key={table}>
            <p className="mb-1.5 text-xs font-medium text-gray-400">Table {table}</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: section.seats_per_table }, (_, i) => i + 1).map((seatNum) => {
                const label = `${section.name}-T${table}-${seatNum}`;
                const isTaken = bookedSeats.includes(label);
                const isSelected = selectedSeats.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={isTaken}
                    onClick={() => onToggleSeat(label)}
                    title={label}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition ${
                      isTaken
                        ? 'cursor-not-allowed bg-magenta/30 text-magenta/70'
                        : isSelected
                        ? 'bg-mint text-ink'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {seatNum}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
