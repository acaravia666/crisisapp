import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Filter, Clock, MapPin, Loader2, X, Search } from 'lucide-react';
import { apiClient } from '../api/client';
import { getSavedCoords } from './Home';

interface GearRequest {
  id:         string;
  equipment:  string;
  urgency:    'normal' | 'soon' | 'urgent' | 'emergency';
  distance_m?: number;
  created_at: string;
  category?:  string;
  users: { name: string };
}

const URGENCY_STYLES: Record<string, { badge: string; glow: string; label: string }> = {
  emergency: { badge: 'badge-emergency', glow: 'bg-urgency-emergency', label: 'Emergency' },
  urgent:    { badge: 'badge-urgent',    glow: 'bg-urgency-urgent',    label: 'Urgent'    },
  soon:      { badge: 'badge-soon',      glow: 'bg-urgency-soon',      label: 'Soon'      },
  normal:    { badge: 'badge-normal',    glow: 'bg-blue-500',          label: 'Normal'    },
};

const formatTimeAgo = (dateString: string) => {
  const mins = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const Feed = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navState   = location.state as { query?: string; category?: string } | null;
  const initQuery  = navState?.query    ?? '';
  const initCat    = navState?.category ?? '';

  const [requests, setRequests]   = useState<GearRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initQuery);
  const [activeQuery, setActiveQuery] = useState(initQuery);
  const [activeCategory, setActiveCategory] = useState(initCat);

  // Fetch with real coords
  useEffect(() => {
    const { lat, lng } = getSavedCoords();
    setIsLoading(true);
    apiClient
      .get(`/requests/nearby?lat=${lat}&lng=${lng}&radius=50&limit=50`)
      .then(res => setRequests(res.data.requests || []))
      .catch(() => setRequests([]))
      .finally(() => setIsLoading(false));
  }, []);

  // When nav state changes (e.g. user navigates from Home again)
  useEffect(() => {
    if (navState?.query)    setActiveQuery(navState.query);
    if (navState?.category) setActiveCategory(navState.category);
  }, [location.state]);

  // Client-side filter
  const filtered = useMemo(() => {
    let list = requests;
    if (activeCategory) {
      list = list.filter(r => r.category === activeCategory);
    }
    if (activeQuery.trim()) {
      const q = activeQuery.trim().toLowerCase();
      list = list.filter(r => r.equipment.toLowerCase().includes(q));
    }
    return list;
  }, [requests, activeQuery, activeCategory]);

  const clearFilters = () => {
    setActiveQuery('');
    setActiveCategory('');
    setSearchInput('');
  };

  const hasFilter = activeQuery || activeCategory;

  return (
    <div className="flex flex-col h-full animate-slide-up pt-4">

      {/* Header */}
      <div className="flex justify-between items-center mb-4 px-4">
        <h1 className="text-2xl font-bold">Nearby Requests</h1>
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs font-bold text-urgency-emergency bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="px-4 mb-4">
        <form
          onSubmit={e => { e.preventDefault(); setActiveQuery(searchInput); }}
          className="relative"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Filter by equipment..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full bg-secondary border border-bg-glass-border rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setActiveQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            >
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      {/* Active filter chips */}
      {hasFilter && (
        <div className="flex gap-2 px-4 mb-3 flex-wrap">
          {activeQuery && (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-[11px] font-bold">
              <Search size={10} /> "{activeQuery}"
            </span>
          )}
          {activeCategory && (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-accent-purple/10 border border-accent-purple/30 text-accent-purple text-[11px] font-bold">
              <Filter size={10} /> {activeCategory.replace('_', ' ')}
            </span>
          )}
        </div>
      )}

      {/* List */}
      <div className="flex-1 px-4 space-y-4 pb-24 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="animate-spin text-accent-cyan" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary text-sm">
              {hasFilter ? 'No requests match your search.' : 'No requests nearby right now.'}
            </p>
            {hasFilter && (
              <button onClick={clearFilters} className="mt-3 text-xs text-accent-cyan font-bold">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filtered.map(req => {
            const style = URGENCY_STYLES[req.urgency] ?? URGENCY_STYLES.normal;
            const dist  = req.distance_m != null ? `${(req.distance_m / 1000).toFixed(1)} km` : null;
            return (
              <div
                key={req.id}
                className="glass-panel p-4 relative overflow-hidden cursor-pointer card-lift active-press"
                onClick={() => navigate(`/requests/${req.id}`)}
              >
                {/* Glow blob */}
                <div className={`absolute top-0 right-0 w-24 h-24 ${style.glow} opacity-10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none`} />

                <div className="flex justify-between items-start mb-2 relative z-10">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{req.equipment}</h3>
                    <div className="flex items-center gap-2 text-xs text-secondary">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {req.users?.name || 'Local Fixer'}
                      </span>
                      {dist && <><span>•</span><span>{dist}</span></>}
                    </div>
                  </div>
                  <span className={`badge ${style.badge}`}>{style.label}</span>
                </div>

                <div className="flex justify-between items-end mt-4 relative z-10">
                  <span className="flex items-center gap-1 text-xs text-muted font-medium">
                    <Clock size={12} />
                    {formatTimeAgo(req.created_at)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/requests/${req.id}`); }}
                    className="px-4 py-2 bg-white text-black font-bold text-sm rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Respond
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Feed;
