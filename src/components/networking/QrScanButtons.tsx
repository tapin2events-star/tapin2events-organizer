import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import ShareQR from '../ShareQR';
import ScanSheet from './ScanSheet';

// The two big actions for meeting people in person: show your personal TapIN QR, or scan someone's.
export default function QrScanButtons({ name }: { name?: string | null }) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  if (!user?.email) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <ShareQR path={`/creator/${encodeURIComponent(user.email)}`} title={name || 'My TapIN'} subtitle="Scan to connect with me on TapIN" label="Show my QR" track="profile_qr"
        className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-3 text-sm font-bold text-white" />
      <button type="button" onClick={() => { setScanning(true); supabase.rpc('track_feature', { p_feature: 'qr_scan' }); }} className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#0F1B3D] px-3 text-sm font-bold text-white">
        <span aria-hidden="true">📷</span> Scan a code
      </button>
      {scanning && <ScanSheet onClose={() => setScanning(false)} />}
    </div>
  );
}
