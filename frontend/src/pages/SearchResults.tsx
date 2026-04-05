import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ArrowLeft, Loader2, X, Zap, Package, Clock, MapPin } from 'lucide-react';
import { apiClient } from '../api/client';
import { getSavedCoords } from './Home';

interface GearRequest {
  id:          string;
  equipment:   string;
  urgency:     string;
  distance_m?: number;
  created_at:  string;
  users?:      { name: string };
}

interface GearItem {
  id:          string;
  name:        string;
  category:    string;
  status:      string;
  can_lend:    boolean;
  can_rent:    boolean;
  can_sell:    boolean;
  rent_price?: number;
  sell_price?: number;
  photo_urls:  string[];
  distance_m?: number;
  users?:      { name: string };
}

const URGENCY_BADGE: Record<string, string> = {
  emergency: 'badge-emergency',
  urgent:    'badge-urgent',
  soon:      'badge-soon',
  normal:    'badge-normal',
};

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const SearchResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initQuery = (location.state as { query?: string })?.query ?? '';

  const [query, setQuery]         = useState(initQuery);
  const [input, setInput]         = useState(initQuery);
  const [requests, setRequests]   = useState<GearRequest[]>([]);
  const [gear, setGear]           = useState<GearItem[]>([]);
  const [loading, setLoading]     = useState(false);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setLoading(true);

    const { lat, lng } = getSavedCoords();

    try {
      const [reqRes, gearRes] = await Promise.all([
        apiClient.get(`/requests/nearby?lat=${lat}&lng=${lng}&radius=50&limit=50`),
        apiClient.get(`/gear/nearby?lat=${lat}&lng=${lng}&radius=50&limit=50`),
      ]);

      const lower = trimmed.toLowerCase();

      const filteredReqs: GearRequest[] = (reqRes.data.requests || []).filter(
        (r: GearRequest) => r.equipment.toLowerCase().includes(lower)
      );
      const filteredGear: GearItem[] = (gearRes.data.items || []).filter(
        (g: GearItem) =>
          g.name.toLowerCase().includes(lower) &&
          g.status === 'available'
      );

      setRequests(filteredReqs);
      setGear(filteredGear);
    } catch {
      setRequests([]);
      setGear([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initQuery) doSearch(initQuery);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    doSearch(input);
  };

  const totalResults = requests.length + gear.length;

  return (
    <div className="flex flex-col h-full bg-bg-primary animate-fade-in">

      {/* Search bar header */}
      <div className="px-4 pt-4 pb-3 border-b border-bg-glass-border bg-bg-primary">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted hover:text-white shrink-0">
            <ArrowLeft size={22} />
          </button>
          <form onSubmit={handleSubmit} className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Search gear or requests..."
              className="w-full bg-secondary border border-bg-glass-border rounded-xl py-2.5 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
            {input && (
              <button
                type="button"
                onClick={() => { setInput(''); setQuery(''); setRequests([]); setGear([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                <X size={14} />
              </button>
            )}
          </form>
        </div>

        {query && !loading && (
          <p className="text-xs text-muted mt-2 pl-9">
            {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-accent-cyan" />
          </div>
        ) : !query ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search size={40} className="text-gray-700" />
            <p className="text-secondary text-sm">Type something to search</p>
          </div>
        ) : totalResults === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Package size={40} className="text-gray-700" />
            <p className="text-secondary text-sm">No results for "{query}"</p>
            <p className="text-muted text-xs">Try a different term</p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-6">

            {/* ── Requests ─────────────────────────────────────────── */}
            {requests.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Zap size={13} className="text-urgency-emergency" />
                  Requests ({requests.length})
                </h2>
                <div className="space-y-3">
                  {requests.map(req => (
                    <div
                      key={req.id}
                      onClick={() => navigate(`/requests/${req.id}`)}
                      className="glass-panel p-4 cursor-pointer card-lift active-press"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-sm mb-0.5">{req.equipment}</h3>
                          <p className="text-xs text-secondary flex items-center gap-1">
                            <MapPin size={10} /> {req.users?.name || 'Local Fixer'}
                            {req.distance_m != null && (
                              <> · {(req.distance_m / 1000).toFixed(1)}km</>
                            )}
                          </p>
                        </div>
                        <span className={`badge ${URGENCY_BADGE[req.urgency] ?? 'badge-normal'}`}>
                          {req.urgency}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted flex items-center gap-1">
                        <Clock size={10} /> {timeAgo(req.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Available Gear ────────────────────────────────────── */}
            {gear.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Package size={13} className="text-accent-cyan" />
                  Available Gear ({gear.length})
                </h2>
                <div className="space-y-3">
                  {gear.map(item => {
                    const photo = item.photo_urls?.[0];
                    const terms = [
                      item.can_lend && 'Lend',
                      item.can_rent && `Rent${item.rent_price ? ` $${item.rent_price}/d` : ''}`,
                      item.can_sell && `Sell${item.sell_price ? ` $${item.sell_price}` : ''}`,
                    ].filter(Boolean).join(' · ');

                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/gear/${item.id}`)}
                        className="glass-panel p-0 overflow-hidden cursor-pointer card-lift active-press flex items-center"
                      >
                        {/* Thumbnail */}
                        <div className="w-16 h-16 bg-gray-800 shrink-0 flex items-center justify-center overflow-hidden">
                          {photo
                            ? <img src={photo} alt={item.name} className="w-full h-full object-cover" />
                            : <Package size={22} className="text-gray-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0 px-4 py-3">
                          <h3 className="font-bold text-sm truncate">{item.name}</h3>
                          <p className="text-xs text-secondary capitalize mt-0.5">
                            {item.category.replace(/_/g, ' ')}
                          </p>
                          {terms && (
                            <p className="text-[10px] text-accent-cyan font-bold mt-1">{terms}</p>
                          )}
                        </div>
                        {item.distance_m != null && (
                          <p className="text-[10px] text-muted font-bold pr-4 shrink-0">
                            {(item.distance_m / 1000).toFixed(1)}km
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
