import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, MapPin, MessageSquare, Clock, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface LocationState {
  requestId: string;
  equipment: string;
  lat?:      number;
  lng?:      number;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const road    = data.address?.road ?? data.address?.pedestrian ?? '';
    const suburb  = data.address?.suburb ?? data.address?.neighbourhood ?? '';
    return [road, suburb].filter(Boolean).join(', ') || 'Nearby location';
  } catch {
    return 'Nearby location';
  }
}

const Transaction = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { requestId, equipment, lat, lng } =
    (location.state as LocationState) ?? {};

  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');
  const [meetup, setMeetup]         = useState<string>('Arrange via chat');

  useEffect(() => {
    if (lat != null && lng != null) {
      reverseGeocode(lat, lng).then(setMeetup);
    }
  }, [lat, lng]);

  const handleHandoff = async () => {
    setIsLoading(true);
    setError('');
    try {
      if (requestId) {
        await apiClient.patch(`/requests/${requestId}/fulfill`);
      }
      navigate('/rating', { state: { requestId, equipment } });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not complete handoff. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-slide-up bg-bg-primary pt-6 px-4">

      {/* Icon */}
      <div className="flex justify-center items-center mb-10 mt-6">
        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
          <ShieldCheck size={48} className="text-green-500" />
        </div>
      </div>

      <h1 className="text-3xl font-extrabold text-center mb-2">Deal Confirmed</h1>
      <p className="text-secondary text-center mb-8">
        {equipment ? `Responding to: ${equipment}` : 'Gear handoff in progress.'}
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      <div className="glass-panel space-y-5 mb-8">

        {/* Meetup */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700 shrink-0">
            <MapPin size={20} className="text-urgency-soon" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted uppercase tracking-wider mb-0.5">Meetup Point</p>
            <p className="text-sm font-bold truncate">{meetup}</p>
            {lat != null && lng != null && (
              <p className="text-[10px] text-muted mt-0.5">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700 shrink-0">
            <MessageSquare size={20} className="text-accent-cyan" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted uppercase tracking-wider mb-0.5">Terms</p>
            <p className="text-sm font-bold">Agreed via chat</p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700 shrink-0">
            <Clock size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted uppercase tracking-wider mb-0.5">Status</p>
            <p className="text-sm font-bold text-green-400 animate-pulse">Awaiting Handoff</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleHandoff}
        disabled={isLoading}
        className="mt-auto mb-8 py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg text-black bg-white transition-all hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading && <Loader2 size={20} className="animate-spin text-black" />}
        {isLoading ? 'Confirming...' : 'Simulate Handoff Complete'}
      </button>
    </div>
  );
};

export default Transaction;
