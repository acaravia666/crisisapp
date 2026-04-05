import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Zap, MapPin, Loader2, Search,
  Speaker, Mic, Cable, Disc, Wrench, ArrowRight,
  X, Bell, BellOff, CheckCheck,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { apiClient } from '../api/client';

interface NearbyRequest {
  id:        string;
  equipment: string;
  urgency:   string;
  distance_m?: number;
}

interface NearbyGear {
  id:         string;
  name:       string;
  category:   string;
  photo_urls: string[];
  distance_m?: number;
  can_rent:   boolean;
  can_lend:   boolean;
  can_sell:   boolean;
  rent_price?: number;
}

interface Notification {
  id:         string;
  type:       string;
  title:      string;
  body?:      string;
  data?:      Record<string, string> | null;
  is_read:    boolean;
  created_at: string;
}

interface Coords { lat: number; lng: number }

const CATEGORIES = [
  { id: 'cables',       name: 'Cables',       icon: Cable,      color: 'text-accent-cyan'        },
  { id: 'speakers',     name: 'Speakers',      icon: Speaker,    color: 'text-accent-purple'      },
  { id: 'microphones',  name: 'Mics',          icon: Mic,        color: 'text-urgency-urgent'     },
  { id: 'dj_gear',      name: 'DJ Gear',       icon: Disc,       color: 'text-blue-400'           },
  { id: 'power',        name: 'Power',         icon: Wrench,     color: 'text-urgency-soon'       },
  { id: 'accessories',  name: 'Accessories',   icon: ShieldAlert, color: 'text-urgency-emergency' },
];

const FALLBACK: Coords = { lat: -34.6037, lng: -58.3816 };

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      'Nearby';
    const country = data.address?.country_code?.toUpperCase() ?? '';
    return country ? `${city}, ${country}` : city;
  } catch {
    return 'Location unavailable';
  }
}

function saveCoords(coords: Coords) {
  localStorage.setItem('user_coords', JSON.stringify(coords));
}

export function getSavedCoords(): Coords {
  try {
    const raw = localStorage.getItem('user_coords');
    if (raw) return JSON.parse(raw) as Coords;
  } catch { /* */ }
  return FALLBACK;
}

function formatTimeAgo(dateString: string): string {
  const mins = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

const NOTIF_ICON: Record<string, string> = {
  new_match:           '🎯',
  emergency_broadcast: '🚨',
  message:             '💬',
  transaction_update:  '🤝',
  review_received:     '⭐',
  request_expired:     '⏰',
};

function getNotifAction(notif: Notification): { route: string; state?: Record<string, string> } | null {
  const data = notif.data as Record<string, string> | null;
  switch (notif.type) {
    case 'new_match':
    case 'emergency_broadcast':
    case 'transaction_update':
    case 'request_expired':
      return data?.request_id ? { route: `/requests/${data.request_id}` } : { route: '/requests' };
    case 'message':
      if (!data?.context_id) return null;
      return {
        route: `/chat/${data.context_id}`,
        state: data.sender_id ? { recipientId: data.sender_id } : undefined,
      };
    case 'review_received':
      return { route: '/profile' };
    default:
      return null;
  }
}

const Home = () => {
  const navigate = useNavigate();
  const { user }  = useAuth();

  const [coords, setCoords]               = useState<Coords>(getSavedCoords());
  const [locationLabel, setLocationLabel] = useState<string>('Locating...');
  const [nearby, setNearby]               = useState<NearbyRequest[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [nearbyGear, setNearbyGear]       = useState<NearbyGear[]>([]);
  const [searchQuery, setSearchQuery]     = useState('');

  // ── Notifications ────────────────────────────────────────────────────────
  const [showNotifs, setShowNotifs]           = useState(false);
  const [notifications, setNotifications]     = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs]     = useState(false);
  const [unreadCount, setUnreadCount]         = useState(0);

  const openNotifications = useCallback(async () => {
    setShowNotifs(true);
    setLoadingNotifs(true);
    try {
      const res = await apiClient.get('/users/me/notifications?limit=20');
      const notifs: Notification[] = res.data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(0);
      // Mark all as read
      if (notifs.some(n => !n.is_read)) {
        apiClient.post('/users/me/notifications/read').catch(() => {});
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  // Fetch unread count on mount
  useEffect(() => {
    apiClient.get('/users/me/notifications?limit=50')
      .then(res => {
        const notifs: Notification[] = res.data.notifications || [];
        setUnreadCount(notifs.filter(n => !n.is_read).length);
      })
      .catch(() => {});
  }, []);

  // ── Geolocation ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLabel('Location unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        saveCoords(c);
        const label = await reverseGeocode(c.lat, c.lng);
        setLocationLabel(label);
        // Persist location to DB so gear/nearby query works
        apiClient.post('/users/me/location', {
          lat: c.lat,
          lng: c.lng,
          accuracy_m: pos.coords.accuracy ?? undefined,
        }).catch(() => {});
      },
      () => {
        reverseGeocode(coords.lat, coords.lng).then(setLocationLabel);
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  // ── Nearby requests ───────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingNearby(true);
    const { lat, lng } = coords;
    // Fetch nearby requests
    apiClient
      .get(`/requests/nearby?lat=${lat}&lng=${lng}&radius=10&limit=3`)
      .then(res => setNearby(res.data.requests || []))
      .catch(() => setNearby([]))
      .finally(() => setLoadingNearby(false));
    // Fetch nearby gear
    apiClient
      .get(`/gear/nearby?lat=${lat}&lng=${lng}&radius=10&limit=6`)
      .then(res => setNearbyGear(res.data.items || []))
      .catch(() => setNearbyGear([]));
  }, [coords.lat, coords.lng]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback((q: string) => {
    const query = q.trim();
    if (!query) return;
    navigate('/search', { state: { query } });
  }, [navigate]);

  return (
    <div className="page-container flex flex-col h-full bg-primary">

      {/* Header */}
      <header className="flex justify-between items-center mb-6 mt-4 animate-slide-up stagger-1">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-secondary border border-bg-glass-border flex items-center justify-center">
            <span className="text-sm font-bold text-white uppercase">
              {user?.name?.charAt(0) || '?'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold">{user?.name || 'Musician'}</span>
            <span className="text-xs text-secondary flex items-center gap-1">
              <MapPin size={12} className="text-accent-cyan" />
              {locationLabel}
            </span>
          </div>
        </div>

        {/* Notifications button */}
        <button
          onClick={openNotifications}
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center relative active-press"
          aria-label="Notifications"
        >
          <Zap size={20} className="text-urgency-soon" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-urgency-emergency rounded-full border-2 border-bg-primary flex items-center justify-center">
              <span className="text-[8px] font-black text-white leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </div>
          )}
        </button>
      </header>

      {/* Search */}
      <section className="mb-8 animate-slide-up stagger-2">
        <form
          onSubmit={e => { e.preventDefault(); handleSearch(searchQuery); }}
          className="relative group"
        >
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent-cyan"
            size={20}
          />
          <input
            type="text"
            placeholder="Search: 'XLR Cable', '9V Battery', 'Snare'..."
            className="w-full bg-secondary border border-bg-glass-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 transition-all shadow-lg"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search equipment"
          />
        </form>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
          {['Cables', 'Adapter', '9V Battery', 'Snare', 'DI Box'].map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => handleSearch(tag)}
              className="px-3 py-1.5 rounded-full bg-tertiary/50 border border-bg-glass-border text-[10px] font-bold text-secondary hover:text-white whitespace-nowrap transition-colors active-press"
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mb-10 animate-slide-up stagger-3">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-lg font-bold tracking-tight">Categories</h2>
          <button
            onClick={() => navigate('/requests')}
            className="text-xs font-bold text-accent-cyan flex items-center gap-1 active-press"
          >
            View All <ArrowRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat, idx) => (
            <button
              key={cat.id}
              onClick={() => navigate('/requests', { state: { category: cat.id } })}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-secondary/50 border border-bg-glass-border card-lift active-press animate-slide-up"
              style={{ animationDelay: `${(idx + 5) * 50}ms` }}
              aria-label={`Browse ${cat.name}`}
            >
              <cat.icon size={24} className={`${cat.color} mb-2`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Available Gear Nearby */}
      {nearbyGear.length > 0 && (
        <section className="mb-8 animate-slide-up stagger-4">
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-lg font-bold tracking-tight">Available Nearby</h2>
            <button
              onClick={() => navigate('/requests')}
              className="text-xs font-bold text-accent-cyan flex items-center gap-1 active-press"
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {nearbyGear.map(item => (
              <div
                key={item.id}
                onClick={() => navigate(`/gear/${item.id}`)}
                className="flex-shrink-0 w-36 glass-panel p-0 overflow-hidden cursor-pointer card-lift active-press"
              >
                <div className="w-full h-28 bg-gray-800 flex items-center justify-center overflow-hidden">
                  {item.photo_urls?.[0]
                    ? <img src={item.photo_urls[0]} alt={item.name} className="w-full h-full object-cover" />
                    : <span className="text-3xl">🎸</span>
                  }
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold truncate">{item.name}</p>
                  <p className="text-[10px] text-accent-cyan font-bold mt-0.5">
                    {item.can_rent && item.rent_price ? `$${item.rent_price}/hr` : item.can_lend ? 'Free Lend' : 'For Sale'}
                  </p>
                  {item.distance_m != null && (
                    <p className="text-[9px] text-muted mt-0.5">{(item.distance_m / 1000).toFixed(1)} km away</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Emergency CTA */}
      <div className="mb-10 animate-slide-up stagger-4">
        <div className="relative w-full">
          <div className="absolute inset-0 bg-urgency-emergency opacity-20 blur-3xl rounded-full scale-110 animate-pulse" />
          <button
            onClick={() => navigate('/create-request')}
            className="btn-emergency py-8 relative z-10 active-press"
            aria-label="Request emergency gear immediately"
          >
            <div className="btn-emergency-pulse" />
            <div className="btn-emergency-pulse" style={{ animationDelay: '1s' }} />
            <ShieldAlert size={42} className="mb-2 text-white" />
            <div className="flex flex-col items-center">
              <span className="text-display text-2xl">NEED GEAR NOW</span>
              <span className="text-sm font-bold opacity-90 tracking-[0.2em]">EMERGENCY REQUEST</span>
            </div>
          </button>
        </div>
      </div>

      {/* Active Nearby */}
      <div className="mt-auto mb-10 glass-panel animate-slide-up stagger-5" role="region" aria-label="Nearby active requests">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
            <Zap size={14} className="text-accent-cyan" />
            Active Nearby
          </h3>
          {nearby.length > 0 && (
            <span className="badge badge-emergency">{nearby.length} LIVE</span>
          )}
        </div>

        {loadingNearby ? (
          <div className="flex justify-center py-6">
            <Loader2 size={24} className="animate-spin text-accent-cyan" />
          </div>
        ) : nearby.length === 0 ? (
          <p className="text-sm text-muted text-center py-4 italic">The area is currently quiet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {nearby.map((req, index) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-4 rounded-xl bg-bg-secondary/40 border border-bg-glass-border cursor-pointer card-lift active-press animate-slide-up"
                style={{ animationDelay: `${(index + 8) * 100}ms` }}
                onClick={() => navigate(`/requests/${req.id}`)}
                role="button"
                aria-label={`Gear request: ${req.equipment}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${req.urgency === 'emergency' ? 'bg-urgency-emergency' : 'bg-urgency-soon'}`} />
                    <div className={`absolute inset-0 rounded-full animate-ping opacity-40 ${req.urgency === 'emergency' ? 'bg-urgency-emergency' : 'bg-urgency-soon'}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold tracking-tight">{req.equipment}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${req.urgency === 'emergency' ? 'text-urgency-emergency' : 'text-urgency-soon'}`}>
                      {req.urgency}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-muted uppercase">
                  {req.distance_m != null ? `${(req.distance_m / 1000).toFixed(1)}km` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Notifications Panel ────────────────────────────────────────────── */}
      {showNotifs && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowNotifs(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-bg-secondary rounded-t-3xl border-t border-bg-glass-border animate-slide-up"
            style={{ maxHeight: '75vh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-bg-glass-border">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Bell size={16} className="text-urgency-soon" />
                Notifications
              </h2>
              <button onClick={() => setShowNotifs(false)} className="text-muted hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(75vh - 90px)' }}>
              {loadingNotifs ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-accent-cyan" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <BellOff size={40} className="text-gray-600" />
                  <p className="text-secondary text-sm">No notifications yet.</p>
                  <p className="text-muted text-xs">Activity will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-bg-glass-border">
                  {notifications.map(notif => {
                    const action = getNotifAction(notif);
                    return (
                    <div
                      key={notif.id}
                      onClick={() => { if (action) { setShowNotifs(false); navigate(action.route, { state: action.state }); } }}
                      className={`flex gap-3 px-5 py-4 transition-colors ${!notif.is_read ? 'bg-accent-cyan/5' : ''} ${action ? 'cursor-pointer hover:bg-white/5 active:bg-white/10' : ''}`}
                    >
                      <span className="text-xl shrink-0 mt-0.5">
                        {NOTIF_ICON[notif.type] ?? '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-semibold leading-tight">{notif.title}</p>
                          {!notif.is_read && (
                            <div className="w-2 h-2 bg-accent-cyan rounded-full shrink-0 mt-1" />
                          )}
                        </div>
                        {notif.body && (
                          <p className="text-xs text-secondary mt-0.5 leading-relaxed">{notif.body}</p>
                        )}
                        <p className="text-[10px] text-muted mt-1">{formatTimeAgo(notif.created_at)}</p>
                      </div>
                    </div>
                  );
                  })}
                  <div className="flex items-center justify-center gap-1.5 py-4 text-xs text-muted">
                    <CheckCheck size={13} />
                    All caught up
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;
