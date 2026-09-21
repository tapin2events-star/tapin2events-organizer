import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TapEvent } from '../../lib/types';

// Vite bundles Leaflet's default marker images at paths the library can't
// resolve on its own -- point it at CDN-hosted copies instead of shipping
// broken (invisible) map pins.
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function DiscoverMap({ events }: { events: TapEvent[] }) {
  const withCoords = events.filter((e) => e.latitude != null && e.longitude != null);

  if (withCoords.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
        <p className="text-lg font-semibold text-gray-500">No mappable events</p>
        <p className="mt-1 text-gray-400">None of the events matching your filters have a location set yet.</p>
      </div>
    );
  }

  const center: [number, number] = [
    withCoords.reduce((sum, e) => sum + Number(e.latitude), 0) / withCoords.length,
    withCoords.reduce((sum, e) => sum + Number(e.longitude), 0) / withCoords.length,
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200" style={{ height: '65vh' }}>
      <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {withCoords.map((event) => (
          <Marker key={event.id} position={[Number(event.latitude), Number(event.longitude)]} icon={markerIcon}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-semibold text-gray-900">{event.title}</p>
                {event.start_date && (
                  <p className="text-xs text-gray-500">
                    {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
                <Link to={`/events/${event.id}`} className="mt-1 inline-block text-xs font-medium text-marigold hover:underline">
                  View event &rarr;
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
