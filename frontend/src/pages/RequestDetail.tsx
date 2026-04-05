import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Navigation, MessageSquare, Loader2, MapPin,
  Package, Check, ChevronRight, X, Handshake, Clock, DollarSign
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
  rent_price?: number;
  sell_price?: number;
  can_rent:   boolean;
  can_lend:   boolean;
  can_sell:   boolean;
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

  // Gear selection & Offer settings
  const [showGearSelect, setShowGearSelect]     = useState(false);
  const [step, setStep]                         = useState<'pick' | 'terms'>('pick');
  const [myGear, setMyGear]                     = useState<GearItem[]>([]);
  const [loadingGear, setLoadingGear]           = useState(false);
  const [selectedGearId, setSelectedGearId]     = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading]       = useState(false);
  
  // Terms
  const [price, setPrice]       = useState<string>('');
  const [duration, setDuration] = useState<string>('1');
  const [unit, setUnit]         = useState<'hours' | 'days'>('days');

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
    setStep('pick');
    setShowGearSelect(true);
    fetchMyGear();
  };

  const currentSelectedGear = myGear.find(g => g.id === selectedGearId);

  useEffect(() => {
    if (currentSelectedGear) {
      const p = request?.action === 'sell' ? currentSelectedGear.sell_price : currentSelectedGear.rent_price;
      setPrice(p?.toString() || '0');
    }
  }, [currentSelectedGear, request?.action]);

  const handleCancelRequest = async () => {
    if (!request) return;
    setCancelLoading(true);
    try {
      await apiClient.patch(`/requests/${request.id}/cancel`);
      navigate('/requests');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not cancel request.');
      setShowCancelConfirm(false);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleConfirmOffer = () => {
    if (!selectedGearId || !request) return;
    
    // Map request.action to transaction_type
    const typeMap: Record<string, string> = {
      'rent': 'rental',
      'lend': 'loan',
      'sell': 'sale'
    };
    
    const finalNotes = request.action === 'sell' ? 'Permanent Transfer' : `Duration: ${duration} ${unit}`;
    
    navigate('/transaction', { 
      state: { 
        requestId: request.id, 
        gearItemId: selectedGearId, 
        borrowerId: request.requester_id, 
        equipment: request.equipment, 
        gearName: currentSelectedGear?.name,
        agreedPrice: parseFloat(price) || 0,
        type: typeMap[request.action] || 'loan',
        notes: finalNotes
      }
    });
  };

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
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex-1 bg-red-500/10 backdrop-blur-md text-red-400 font-bold py-4 rounded-2xl border border-red-500/20"
            >
              Cancel My Request
            </button>
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

      {/* Cancel Confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative w-full max-w-[480px] bg-[#111] rounded-t-[2.5rem] border-t border-white/10 p-6 space-y-4 animate-slide-up">
            <h2 className="text-xl font-black text-center">Cancel Request?</h2>
            <p className="text-sm text-secondary text-center leading-relaxed">
              Your request for <span className="font-bold text-white">{request.equipment}</span> will be removed from the feed.
            </p>
            <button
              onClick={handleCancelRequest}
              disabled={cancelLoading}
              className="w-full bg-red-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
            >
              {cancelLoading ? <Loader2 size={18} className="animate-spin" /> : null}
              {cancelLoading ? 'Cancelling...' : 'Yes, Cancel Request'}
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="w-full bg-white/5 border border-white/10 text-white font-bold py-4 rounded-2xl"
            >
              Keep It
            </button>
          </div>
        </div>
      )}

      {/* Gear Selection & Terms Modal */}
      {showGearSelect && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-fade-in flex flex-col justify-end">
          <div className="absolute inset-0" onClick={() => setShowGearSelect(false)} />
          <div
            className="relative bg-[#111] w-full max-w-[480px] mx-auto rounded-t-[2.5rem] border-t border-white/10 animate-slide-up flex flex-col"
            style={{ maxHeight: '88vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              {step === 'terms' ? (
                <button onClick={() => setStep('pick')} className="flex items-center gap-1.5 text-xs font-black text-muted uppercase tracking-widest">
                  <ChevronRight size={14} className="rotate-180" /> Back
                </button>
              ) : (
                <div />
              )}
              <h2 className="text-base font-black absolute left-1/2 -translate-x-1/2">
                {step === 'pick' ? 'Choose Gear' : 'Deal Terms'}
              </h2>
              <button
                onClick={() => setShowGearSelect(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 pb-4">
              <div className={`h-1 rounded-full transition-all ${step === 'pick' ? 'w-6 bg-white' : 'w-2 bg-white/20'}`} />
              <div className={`h-1 rounded-full transition-all ${step === 'terms' ? 'w-6 bg-white' : 'w-2 bg-white/20'}`} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4 scrollbar-hide">
              {step === 'pick' ? (
                <div className="space-y-3">
                  {loadingGear
                    ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-accent-cyan" /></div>
                    : myGear.length === 0
                      ? <div className="text-center py-12"><p className="text-secondary text-sm">No gear in inventory.</p></div>
                      : myGear.map(gear => (
                        <div
                          key={gear.id}
                          onClick={() => setSelectedGearId(gear.id)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${selectedGearId === gear.id ? 'bg-white/10 border-white/30' : 'bg-white/5 border-white/5'}`}
                        >
                          <div className="w-12 h-12 rounded-xl bg-gray-800 shrink-0 overflow-hidden">
                            {gear.photo_urls?.[0]
                              ? <img src={gear.photo_urls[0]} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><Package size={18} className="text-muted" /></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold truncate">{gear.name}</h4>
                            <p className="text-[10px] text-muted uppercase tracking-widest">{gear.category}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedGearId === gear.id ? 'bg-white border-white' : 'border-white/20'}`}>
                            {selectedGearId === gear.id && <Check size={12} className="text-black" strokeWidth={3} />}
                          </div>
                        </div>
                      ))
                  }
                </div>
              ) : (
                <div className="space-y-5 animate-fade-in">
                  {/* Selected gear summary */}
                  {currentSelectedGear && (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="w-10 h-10 rounded-xl bg-gray-800 shrink-0 overflow-hidden">
                        {currentSelectedGear.photo_urls?.[0]
                          ? <img src={currentSelectedGear.photo_urls[0]} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-muted" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate">{currentSelectedGear.name}</p>
                        <p className="text-[10px] text-muted uppercase tracking-widest">{currentSelectedGear.category}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded-lg">Selected</span>
                    </div>
                  )}

                  {/* Price */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
                      <DollarSign size={12} className="text-green-500" />
                      {request.action === 'sell' ? 'Selling Price' : request.action === 'rent' ? 'Rental Price' : 'Price (0 = free)'}
                    </label>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-green-500/50 transition-colors">
                      <span className="pl-4 pr-2 text-sm font-bold text-secondary">$</span>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="flex-1 bg-transparent py-4 pr-4 text-base font-bold focus:outline-none"
                        placeholder="0.00"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Duration — only for rent/lend */}
                  {request.action !== 'sell' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <Clock size={12} className="text-accent-cyan" /> Duration
                      </label>
                      <div className="flex items-center gap-3">
                        {/* Stepper */}
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setDuration(d => String(Math.max(1, parseInt(d || '1') - 1)))}
                            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-lg font-black active:scale-90 transition-transform"
                          >−</button>
                          <span className="w-8 text-center text-base font-black">{duration}</span>
                          <button
                            type="button"
                            onClick={() => setDuration(d => String(parseInt(d || '1') + 1))}
                            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-lg font-black active:scale-90 transition-transform"
                          >+</button>
                        </div>
                        {/* Unit toggle */}
                        <div className="flex-1 flex bg-white/5 border border-white/10 rounded-2xl p-1">
                          {(['hours', 'days'] as const).map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setUnit(u)}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${unit === u ? 'bg-white text-black shadow' : 'text-muted'}`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-muted/60 font-bold text-center">
                    0% commission · Crisis Mode Active
                  </p>
                </div>
              )}
            </div>

            {/* Footer CTA */}
            <div className="px-6 pb-6 pt-2">
              {step === 'pick' ? (
                <button
                  onClick={() => setStep('terms')}
                  disabled={!selectedGearId}
                  className="w-full bg-white text-black font-black py-4 rounded-2xl disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  Next <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  onClick={handleConfirmOffer}
                  className="w-full bg-green-500 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-green-500/20 active:scale-95 transition-transform"
                >
                  <Check size={18} strokeWidth={3} /> Confirm Deal
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetail;
