import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabaseClient';

type ScanResult = {
  id: number;
  outcome: 'success' | 'already_used' | 'invalid' | 'not_found' | 'error';
  message: string;
  attendeeEmail?: string;
  time: string;
};

const SCANNER_ID = 'qr-reader';

export default function CheckIn() {
  const { id: eventId } = useParams<{ id: string }>();
  const [eventTitle, setEventTitle] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [log, setLog] = useState<ScanResult[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!eventId) return;
    supabase.from('events').select('title').eq('id', eventId).single().then(({ data }) => {
      if (data) setEventTitle(data.title);
    });
  }, [eventId]);

  function extractTicketId(decodedText: string): string {
    // QR encodes a full pass URL (…/pass/<ticketId>); fall back to treating
    // the raw text as the id if it isn't a URL, just in case.
    try {
      const url = new URL(decodedText);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1];
    } catch {
      return decodedText;
    }
  }

  async function handleDecoded(decodedText: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    scannerRef.current?.pause(true);

    const ticketId = extractTicketId(decodedText);
    const { data, error } = await supabase.functions.invoke('check-in-ticket', { body: { ticket_id: ticketId } });

    let result: ScanResult;
    if (error || !data) {
      result = { id: Date.now(), outcome: 'error', message: 'Could not verify this code. Try again.', time: new Date().toLocaleTimeString() };
    } else if (data.error && !data.result) {
      result = { id: Date.now(), outcome: 'error', message: data.error, time: new Date().toLocaleTimeString() };
    } else if (data.result === 'success') {
      result = { id: Date.now(), outcome: 'success', message: 'Checked in', attendeeEmail: data.ticket?.attendee_email, time: new Date().toLocaleTimeString() };
    } else if (data.result === 'already_used') {
      result = { id: Date.now(), outcome: 'already_used', message: `Already checked in at ${new Date(data.checked_in_at).toLocaleTimeString()}`, attendeeEmail: data.ticket?.attendee_email, time: new Date().toLocaleTimeString() };
    } else if (data.result === 'invalid') {
      result = { id: Date.now(), outcome: 'invalid', message: data.error, attendeeEmail: data.ticket?.attendee_email, time: new Date().toLocaleTimeString() };
    } else {
      result = { id: Date.now(), outcome: 'not_found', message: data.error || 'Ticket not found.', time: new Date().toLocaleTimeString() };
    }

    setLastResult(result);
    setLog((prev) => [result, ...prev].slice(0, 25));
    setBusy(false);

    setTimeout(() => {
      busyRef.current = false;
      scannerRef.current?.resume();
    }, 1800);
  }

  async function startScanning() {
    setCameraError(null);
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => handleDecoded(decodedText),
        () => { /* per-frame no-QR-found noise; ignore */ }
      );
      setScanning(true);
    } catch (e) {
      setCameraError('Could not access the camera. Check your browser permissions and try again.');
    }
  }

  async function stopScanning() {
    try {
      await scannerRef.current?.stop();
    } catch {
      /* ignore */
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  const outcomeStyles: Record<ScanResult['outcome'], string> = {
    success: 'bg-green-100 text-green-800 border-green-300',
    already_used: 'bg-orange-100 text-orange-800 border-orange-300',
    invalid: 'bg-red-100 text-red-800 border-red-300',
    not_found: 'bg-gray-100 text-gray-800 border-gray-300',
    error: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  return (
    <div>
      <Link to={`/organizer/events/${eventId}`} className="text-sm text-marigold hover:underline">&larr; Back to event</Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-bone">Check-in scanner</h1>
      <p className="text-sm text-muted">{eventTitle}</p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <div id={SCANNER_ID} className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-black" />

        {cameraError && <p className="text-sm text-magenta">{cameraError}</p>}

        {!scanning ? (
          <button onClick={startScanning} className="rounded-lg bg-marigold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-marigold/90">
            Start scanning
          </button>
        ) : (
          <button onClick={stopScanning} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-bone hover:border-magenta hover:text-magenta">
            Stop scanning
          </button>
        )}

        {busy && <p className="text-sm text-muted">Verifying…</p>}

        {lastResult && (
          <div className={`w-full max-w-sm rounded-xl border p-4 text-center ${outcomeStyles[lastResult.outcome]}`}>
            <p className="text-lg font-bold">{lastResult.message}</p>
            {lastResult.attendeeEmail && <p className="mt-1 text-sm">{lastResult.attendeeEmail}</p>}
          </div>
        )}
      </div>

      {log.length > 0 && (
        <div className="mx-auto mt-8 max-w-sm">
          <h2 className="font-display text-sm font-semibold text-bone">Recent scans</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {log.map((entry) => (
              <li key={entry.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${outcomeStyles[entry.outcome]}`}>
                <span className="truncate">{entry.attendeeEmail || entry.message}</span>
                <span className="shrink-0 pl-2">{entry.time}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
