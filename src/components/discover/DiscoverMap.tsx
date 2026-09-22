import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabaseClient';
import type { TapEvent } from '../../lib/types';

// Vite bundles Leaflet's default marker images at paths the library can't
// resolve on its own -- point it at CDN-hosted copies instead of shipping
// broken (invisible) map pins.
const eventMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// A distinct violet marker for resources/artists, served via jsDelivr's
// GitHub-proxy CDN (production-appropriate, unlike raw.githubusercontent.com).
const resourceMarkerIcon = new L.Icon({
  iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-violet.png',
  iconRetinaUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MILES_TO_METERS = 1609.34;

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// react-leaflet doesn't re-center an already-mounted map when its `center`
// prop changes -- this small helper imperatively pans/zooms it whenever
// the search location changes.
function RecenterOnChange({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

interface ResourcePin {
  id: string;
  display_name: string;
  categories: string[] | null;
  latitude: number;
  longitude: number;
}

export default function DiscoverMap({ events }: { events: TapEvent[] }) {
  const [cityInput, setCityInput] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [resources, setResources] = useState<ResourcePin[]>([]);

  useEffect(() => {
    supabase
      .from('resources')
      .select('id, display_name, categories, latitude, longitude')
      .eq('status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .then(({ data }) => setResources((data ?? []) as ResourcePin[]));
  }, []);

  const withCoords = useMemo(() => events.filter((e) => e.latitude != null && e.longitude != null), [events]);

  const visibleEvents = useMemo(() => {
    if (!searchLocation) return withCoords;
    return withCoords.filter(
      (e) => haversineMiles(searchLocation.lat, searchLocation.lng, Number(e.latitude), Number(e.longitude)) <= radiusMiles
    );
  }, [withCoords, searchLocation, radiusMiles]);

  const visibleResources = useMemo(() => {
    if (!searchLocation) return resources;
    return resources.filter((r) => haversineMiles(searchLocation.lat, searchLocation.lng, r.latitude, r.longitude) <= radiusMiles);
  }, [resources, searchLocation, radiusMiles]);

  const fallbackCenter: [number, number] =
    withCoords.length > 0
      ? [
          withCoords.reduce((sum, e) => sum + Number(e.latitude), 0) / withCoords.length,
          withCoords.reduce((sum, e) => sum + Number(e.longitude), 0) / withCoords.length,
        ]
      : [39.8283, -98.5795]; // center of the US, if nothing else to go on

  const mapCenter: [number, number] = searchLocation ? [searchLocation.lat, searchLocation.lng] : fallbackCenter;

  async function handleSearchArea() {
    if (!cityInput.trim() && !stateInput.trim()) return;
    setGeocoding(true);
    setLocationError(null);
    try {
      const query = [cityInput, stateInput].filter(Boolean).join(', ');
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
      );
      const results = await res.json();
      if (results.length === 0) {
        setLocationError('Could not find that location. Try a different city or state.');
      } else {
        setSearchLocation({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
      }
    } catch {
      setLocationError('Something went wrong searching for that location.');
    }
    setGeocoding(false);
  }

  function handleNearMe() {
    if (!navigator.geolocation) {
      setLocationError('Location services are not available on this device.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setCityInput('');
        setStateInput('');
        setLocating(false);
      },
      () => {
        setLocationError('Could not get your location. Check your device permissions.');
        setLocating(false);
      }
    );
  }

  const totalVisible = visibleEvents.length + visibleResources.length;

  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-teal-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-marigold">TapIN Map</p>
        <p className="mt-1 font-display text-xl font-bold text-gray-900">Explore events, artists, and resources near you</p>
        <p className="mt-1 text-sm text-gray-500">
          Showing {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'} and {visibleResources.length} resource{visibleResources.length === 1 ? '' : 's'}
          {searchLocation ? ` within ${radiusMiles} miles` : ''}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="City"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold"
          />
          <input
            value={stateInput}
            onChange={(e) => setStateInput(e.target.value)}
            placeholder="State"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold"
          />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={handleSearchArea}
            disabled={geocoding || (!cityInput.trim() && !stateInput.trim())}
            className="rounded-xl bg-white px-4 py-2.5 font-medium text-gray-900 shadow-sm disabled:opacity-50"
          >
            {geocoding ? 'Searching…' : '🔍 Search Area'}
          </button>
          <button
            onClick={handleNearMe}
            disabled={locating}
            className="rounded-xl bg-white px-4 py-2.5 font-medium text-marigold shadow-sm disabled:opacity-50"
          >
            {locating ? 'Locating…' : '📍 Near me'}
          </button>
        </div>
        {locationError && <p className="mt-2 text-sm text-magenta">{locationError}</p>}

        {searchLocation && (
          <div className="mt-4 rounded-xl bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Search radius</p>
              <button onClick={() => setSearchLocation(null)} className="text-xs font-medium text-gray-400 hover:text-gray-600">
                Clear
              </button>
            </div>
            <p className="text-xs text-gray-500">Showing results within {radiusMiles} miles</p>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              className="mt-2 w-full accent-marigold"
            />
          </div>
        )}
      </div>

      {totalVisible === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
          <p className="text-lg font-semibold text-gray-500">Nothing to show on the map</p>
          <p className="mt-1 text-gray-400">
            {searchLocation ? 'Try a larger radius or a different location.' : "None of the events or resources matching your filters have a location set yet."}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200" style={{ height: '55vh' }}>
          <MapContainer center={mapCenter} zoom={searchLocation ? 10 : 6} style={{ height: '100%', width: '100%' }}>
            <RecenterOnChange center={mapCenter} zoom={searchLocation ? 10 : 6} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {searchLocation && (
              <Circle
                center={[searchLocation.lat, searchLocation.lng]}
                radius={radiusMiles * MILES_TO_METERS}
                pathOptions={{ color: '#4F46E5', fillColor: '#4F46E5', fillOpacity: 0.08 }}
              />
            )}
            {visibleEvents.map((event) => (
              <Marker key={`event-${event.id}`} position={[Number(event.latitude), Number(event.longitude)]} icon={eventMarkerIcon}>
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
            {visibleResources.map((resource) => (
              <Marker key={`resource-${resource.id}`} position={[resource.latitude, resource.longitude]} icon={resourceMarkerIcon}>
                <Popup>
                  <div className="min-w-[160px]">
                    <p className="font-semibold text-gray-900">{resource.display_name}</p>
                    {resource.categories && resource.categories.length > 0 && (
                      <p className="text-xs capitalize text-gray-500">{resource.categories.join(', ')}</p>
                    )}
                    <Link to={`/resources/${resource.id}`} className="mt-1 inline-block text-xs font-medium text-purple hover:underline">
                      View profile &rarr;
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
