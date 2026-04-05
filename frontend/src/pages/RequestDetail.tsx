import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Navigation, MessageSquare, Loader2, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { apiClient } from '../api/client';

// Fix Leaflet default icon paths broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface RequestData {
  id:           string;
  equipment:    string;
  urgency:      'normal' | 'soon' | 'urgent' | 'emergency';
  notes?:       string;
  raw_text?:    string;
  status:       string;
  requester_id: string;
  lat?:         number;
  lng?:         number;
  users?:       { name: string };
}

const URGENCY_BADGE: Record<string, string> = {
  emergency: 'badge-emergency',
  urgent:    'badge-urgent',
  soon:      'badge-soon',
  normal:    'badge-normal',
};

const URGENCY_COLOR: Record<string, string> = {
  emergency: '#EF4444',
  urgent:    '#EA580C',
  soon:      '#F59E0B',
  normal:    '#3B82F6',
};

// Custom pulsing red marker icon
const pulsingIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:24px;height:24px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 0 0 4px ${color}55,0 2px 8px rgba(0,0,0,0.5);
      animation:none;
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

// Fit map to marker on load
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 15); }, [lat, lng]);
  return null;
}

const RequestDetail = () => {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();

  const [request, setRequest]   = useState<RequestData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!id) return;
    apiClient.get(`/requests/${id}`)
      .then(res => setRequest(res.data.request))
      .catch(() => setError('Could not load request.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={36} className="animate-spin text-accent-cyan" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 px-6">
        <p className="text-secondary text-center">{error || 'Request not found.'}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-accent-cyan">Go back</button>
      </div>
    );
  }

  const hasCoords = request.lat != null && request.lng != null;
  const markerColor = URGENCY_COLOR[request.urgency] ?? URGENCY_COLOR.normal;

  return (
    <div className="flex flex-col min-h-full animate-fade-in bg-bg-primary">

      {/* Map Area */}
      <div className="relative h-64 bg-gray-900 overflow-hidden">
        {hasCoords ? (
          <MapContainer
            center={[request.lat!, request.lng!]}
            zoom={15}
            zoomControl={false}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <FlyTo lat={request.lat!} lng={request.lng!} />
            <Marker
              position={[request.lat!, request.lng!]}
              icon={pulsingIcon(markerColor)}
            />
            <Circle
              center={[request.lat!, request.lng!]}
              radius={300}
              pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: 0.08, weight: 1 }}
            />
          </MapContainer>
        ) : (
          /* Fallback placeholder if no coords */
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
            <MapPin size={40} className="text-gray-500" />
            <span className="text-xs text-gray-500 uppercase tracking-widest">Location unavailable</span>
          </div>
        )}

        {/* Gradient overlay bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none z-[400]" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-gray-700 z-[500]"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
      </div>

      {/* Details */}
      <div className="flex-1 px-4 pt-4 pb-28">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">{request.equipment}</h1>
            <p className="text-secondary text-sm">{request.users?.name || 'Local Fixer'}</p>
          </div>
          <span className={`badge ${URGENCY_BADGE[request.urgency] ?? 'badge-normal'} uppercase`}>
            {request.urgency}
          </span>
        </div>

        {(() => {
          const note = request.notes === 'parser_fallback' ? null : (request.notes || request.raw_text);
          return note ? (
            <div className="glass-panel mb-4">
              <p className="text-sm text-secondary leading-relaxed">"{note}"</p>
            </div>
          ) : null;
        })()}
      </div>

      {/* Action Buttons — fixed bottom */}
      <div className="fixed left-0 right-0 max-w-[480px] mx-auto px-4 pt-4 bg-gradient-to-t from-bg-primary to-transparent z-[110]" style={{ bottom: 'calc(64px + 1.5rem)', paddingBottom: '1rem' }}>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/chat/${request.id}`, { state: { recipientId: request.requester_id, equipment: request.equipment } })}
            className="flex-1 bg-secondary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 border border-bg-glass-border"
          >
            <MessageSquare size={18} /> Chat
          </button>
          <button
            onClick={() => navigate('/transaction', { state: { requestId: request.id, equipment: request.equipment, lat: request.lat, lng: request.lng } })}
            className="flex-1 btn-emergency py-4 text-base shadow-none"
          >
            <Navigation size={18} /> Respond
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestDetail;
