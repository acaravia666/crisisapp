import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Navigation, MessageSquare, Loader2, MapPin,
  Package, Check, ChevronRight, X, Handshake
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { apiClient } from '../api/client';
import { useAuth } from '../store/AuthContext';

// Fix Leaflet issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RequestData {
  id:               string;
  requester_id:     string;
  equipment:        string;
  category:         string;
  quantity:         number;
  urgency:          string;
  action:           string;
  status:           string;
  notes:            string | null;
  lat:              number;
  lng:              number;
  created_at:       string;
  users?: {
    name: string;
  };
}

interface GearItem {
  id:         string;
  name:       string;
  category:   string;
  photo_urls: string[];
}

const URGENCY_COLORS: Record<string, string> = {
  emergency: '#ef4444',
  urgent:    '#f97316',
  soon:      '#eab308',
  normal:    '#06b6d4',
};

const CustomMarker = ({ color }: { color: string }) => {
  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      width:24px;height:24px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  return icon;
};

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => { map.setView(center, 14); }, [center, map]);
  return null;
};

const RequestDetail = () => {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();
  const { user } = useAuth();

  const [request, setRequest]     = useState<RequestData | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState('');

  // Gear selection
  const [showGearSelect, setShowGearSelect] = useState(false);
  const [myGear, setMyGear]                 = useState<GearItem[]>([]);
  const [loadingGear, setLoadingGear]       = useState(false);
  const [selectedGearId, setSelectedGearId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient.get(`/requests/${id}`)
      .then(res => setRequest(res.data.request))
      .catch(() => setError('Could not load request.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const fetchMyGear = async () => {
    setLoadingGear(true);
    try {
      const { data } = await apiClient.get('/gear/mine');
      setMyGear(data.items || []);
    } catch {
      setMyGear([]);
    } finally {
      setLoadingGear(false);
    }
  };

  const handleOpenRespond = () => {
    setShowGearSelect(true);
    fetchMyGear();
  };

  const currentSelectedGear = myGear.find(g => g.id === selectedGearId);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 size={36} className="animate-spin text-accent-cyan" /></div>;
  if (error || !request) return <div className="flex h-full items-center justify-center p-6 text-secondary">{error || 'Request not found.'}</div>;

  const color = URGENCY_COLORS[request.urgency] || '#94a3b8';
  const isMatched = request.status === 'matched' || request.status === 'fulfilled';

  return (
    <div className="flex flex-col h-full bg-bg-primary animate-slide-up relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[100] p-4 flex justify-between items-center pointer-events-none">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 pointer-events-auto">
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Map Area */}
      <div className="h-[40vh] w-full relative">
        <MapContainer center={[request.lat, request.lng]} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <Marker position={[request.lat, request.lng]} icon={CustomMarker({ color })} />
          <Circle center={[request.lat, request.lng]} radius={1000} pathOptions={{ fillColor: color, color: color, weight: 1, fillOpacity: 0.1 }} />
          <MapUpdater center={[request.lat, request.lng]} />
        </MapContainer>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg-primary to-transparent z-10" />
      </div>

      {/* Content */}
      <div className="flex-1 px-4 -mt-12 relative z-20 space-y-6 pb-40 overflow-y-auto">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted" style={{ color }}>{request.urgency} Request</span>
            <h1 className="text-3xl font-black">{request.equipment}</h1>
            <p className="text-secondary font-medium">Requested by {request.users?.name || 'Anonymous'}</p>
          </div>
          <div className="bg-bg-secondary border border-bg-glass-border px-4 py-2 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-bold text-muted block">Qty</span>
            <span className="text-lg font-black">{request.quantity}</span>
          </div>
        </div>

        {request.notes && (
          <div className="glass-panel border-l-4" style={{ borderLeftColor: color }}>
            <p className="text-sm text-secondary leading-relaxed italic">"{request.notes}"</p>
          </div>
        )}

        {isMatched && (
           <div className="glass-panel bg-green-500/10 border-green-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500"><Handshake size={20} /></div>
                 <div>
                    <p className="text-sm font-bold text-green-400">Match Found</p>
                    <p className="text-[10px] text-green-500/80 uppercase font-black tracking-widest leading-none">Gear Secured</p>
                 </div>
              </div>
              <button 
                onClick={async () => {
                   try {
                     const res = await apiClient.get(`/transactions/request/${request.id}`);
                     navigate('/transaction', { state: { transactionId: res.data.transaction.id, equipment: request.equipment }});
                   } catch {
                     setError('Could not find transaction details.');
                   }
                }}
                className="text-xs font-black bg-green-500 text-black px-4 py-2 rounded-xl active:scale-95 transition-transform"
              >
                VIEW DEAL
              </button>
           </div>
        )}

        <div className="glass-panel space-y-4">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><MapPin size={18} className="text-muted" /></div>
              <div><p className="text-xs text-muted font-bold uppercase tracking-widest">Location</p><p className="text-sm font-semibold">Crisis Zone · Approx. 1.2km</p></div>
           </div>
        </div>
      </div>

      {/* Actions */}
      {!isMatched && (
      <div className="fixed bottom-8 left-0 right-0 max-w-[480px] mx-auto px-4 z-[110]">
        <div className="flex gap-3">
          {request.requester_id === user?.id ? (
            <button onClick={() => navigate('/requests')} className="flex-1 bg-white/10 backdrop-blur-md text-white font-bold py-4 rounded-2xl border border-white/10">Manage My Request</button>
          ) : (
            <>
              <button onClick={() => navigate(`/chat/${request.id}`, { state: { recipientId: request.requester_id } })} className="w-14 h-14 bg-white/5 backdrop-blur-md flex items-center justify-center rounded-2xl border border-white/10"><MessageSquare size={22} /></button>
              <button onClick={handleOpenRespond} className="flex-1 bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-white/10">
                <Navigation size={18} className="fill-black" /> Respond Now
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {/* Gear Selection Modal */}
      {showGearSelect && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-fade-in flex flex-col justify-end">
           <div className="absolute inset-0" onClick={() => setShowGearSelect(false)} />
           <div className="relative bg-[#111] w-full max-w-[480px] mx-auto rounded-t-[2.5rem] border-t border-white/10 animate-slide-up flex flex-col" style={{ maxHeight: '80vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="px-6 py-6 border-b border-white/5">
                <h2 className="text-xl font-black">Select Gear to Offer</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingGear ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-accent-cyan" /></div>
                : myGear.length === 0 ? <div className="text-center py-12"><p className="text-secondary">No gear in inventory.</p></div>
                : myGear.map(gear => (
                  <div key={gear.id} onClick={() => setSelectedGearId(gear.id)} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${selectedGearId === gear.id ? 'bg-white/10 border-white/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                    <div className="w-12 h-12 rounded-xl bg-gray-800 shrink-0 overflow-hidden">{gear.photo_urls?.[0] && <img src={gear.photo_urls[0]} className="w-full h-full object-cover" />}</div>
                    <div className="flex-1"><h4 className="text-sm font-bold">{gear.name}</h4><p className="text-[10px] text-muted uppercase">{gear.category}</p></div>
                    {selectedGearId === gear.id && <Check size={18} className="text-white" />}
                  </div>
                ))}
              </div>
              <div className="p-6">
                 <button onClick={() => navigate('/transaction', { state: { requestId: request.id, gearItemId: selectedGearId, borrowerId: request.requester_id, equipment: request.equipment, gearName: currentSelectedGear?.name }})} disabled={!selectedGearId} className="w-full bg-white text-black font-black py-4 rounded-2xl disabled:opacity-30">Confirm Offer</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetail;
