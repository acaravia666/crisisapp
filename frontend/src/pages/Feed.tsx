import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Filter, Clock, MapPin, Loader2, X, Search, Zap, Handshake, Package, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { getSavedCoords } from './Home';

interface GearRequest {
  id:         string;
  equipment:  string;
  urgency:    'normal' | 'soon' | 'urgent' | 'emergency';
  distance_m?: number;
  created_at: string;
  category?:  string;
  users?: { name: string };
  status:     string;
}

interface Transaction {
  id:         string;
  status:     string;
  gear_name?: string;
  gear_item_id: string;
  request_id?: string;
  borrower_id: string;
  lender_id:   string;
  type:       string;
  agreed_price: number;
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
  const [activeDeals, setActiveDeals] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initQuery);
  const [activeQuery, setActiveQuery] = useState(initQuery);
  const [activeCategory, setActiveCategory] = useState(initCat);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      const { lat, lng } = getSavedCoords();
      setIsLoading(true);
      try {
        const [reqRes, txRes] = await Promise.all([
          apiClient.get(`/requests/nearby?lat=${lat}&lng=${lng}&radius=50&limit=50`),
          apiClient.get(`/transactions/mine`)
        ]);
        
        setRequests(reqRes.data.requests || []);
        // Active deals are pending or active
        const openDeals = (txRes.data.transactions || []).filter((tx: Transaction) => 
          tx.status === 'pending' || tx.status === 'active'
        );
        setActiveDeals(openDeals);
      } catch (err) {
        console.error('Feed data error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    let list = requests;
    // Keep requests in feed unless they are completely finished (fulfilled/cancelled by current user flow)
    // Actually, user says: "Until handoff is done, it shouldn't disappear". 
    // Usually 'matched' requests stay in feed for the participants, but for others maybe we hide them?
    // Let's filter out 'fulfilled' and 'cancelled' for everyone.
    list = list.filter(r => r.status !== 'fulfilled' && r.status !== 'cancelled');

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
    <div className="flex flex-col h-full animate-slide-up pt-4 bg-bg-primary">

      {/* Header */}
      <div className="flex justify-between items-center mb-4 px-4">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase">Pulse Feed</h1>
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-[10px] font-black uppercase text-urgency-emergency bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full"
          >
            <X size={10} /> Clear Filters
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="px-4 mb-6">
        <form
          onSubmit={e => { e.preventDefault(); setActiveQuery(searchInput); }}
          className="relative group"
        >
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent-cyan" />
          <input
            type="text"
            placeholder="Search equipment: 'XLR', 'Batteries', 'Monitor'..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full bg-secondary/50 border border-bg-glass-border rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 shadow-lg"
          />
        </form>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide px-4">
        
        {/* ACTIVE DEALS SECTION */}
        {activeDeals.length > 0 && !hasFilter && (
          <section className="mb-10 space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                <Handshake size={14} className="text-green-500" /> Deals In Progress
              </h2>
              <span className="badge badge-emergency">{activeDeals.length} ACTIVE</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
               {activeDeals.map(tx => (
                 <div
                   key={tx.id}
                   onClick={() => navigate('/transaction', { state: { transactionId: tx.id } })}
                   className="flex-shrink-0 w-72 glass-panel p-4 relative overflow-hidden cursor-pointer border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.05)] card-lift active-press"
                 >
                   <div className="absolute top-0 right-0 w-16 h-16 bg-green-500 opacity-10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
                   <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shrink-0">
                         <Package size={22} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="text-[10px] text-green-500 font-black uppercase tracking-widest mb-1">Awaiting Handoff</p>
                         <h4 className="text-sm font-bold truncate mb-2">{tx.gear_name || 'Loading Deal...'}</h4>
                         <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black border border-white/10 px-2 py-0.5 rounded-lg bg-white/5">${tx.agreed_price}</span>
                            <span className="text-[10px] text-muted font-bold flex items-center gap-1">Update <ChevronRight size={12}/></span>
                         </div>
                      </div>
                   </div>
                 </div>
               ))}
            </div>
          </section>
        )}

        {/* NEARBY REQUESTS SECTION */}
        <section className="space-y-4">
          <div className="px-1 flex justify-between items-end">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
              <Zap size={14} className="text-accent-cyan" /> Newest Nearby
            </h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-accent-cyan" size={40} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-secondary/20 rounded-3xl border border-dashed border-white/5">
              <p className="text-secondary text-sm font-medium">
                {hasFilter ? 'No items match your search.' : 'Area is quiet. No requests nearby.'}
              </p>
              {hasFilter && (
                <button onClick={clearFilters} className="mt-4 text-[10px] font-black uppercase text-accent-cyan border-b border-accent-cyan">
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(req => {
                const style = URGENCY_STYLES[req.urgency] ?? URGENCY_STYLES.normal;
                const dist  = req.distance_m != null ? `${(req.distance_m / 1000).toFixed(1)} km` : null;
                const isMyRequest = req.status === 'matched';
                
                return (
                  <div
                    key={req.id}
                    className={`glass-panel p-5 relative overflow-hidden cursor-pointer card-lift active-press transition-all ${isMyRequest ? 'border-accent-cyan/30 bg-accent-cyan/5' : ''}`}
                    onClick={() => navigate(`/requests/${req.id}`)}
                  >
                    {/* Glow blob */}
                    <div className={`absolute top-0 right-0 w-32 h-32 ${style.glow} opacity-10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none`} />

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                           <h3 className="font-black text-xl leading-none">{req.equipment}</h3>
                           {isMyRequest && <span className="text-[9px] bg-accent-cyan text-black font-black px-2 py-0.5 rounded-full uppercase">Deal In Progress</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-secondary uppercase tracking-widest">
                          <span className="flex items-center gap-1">
                            <MapPin size={10} className="text-accent-cyan" /> {req.users?.name || 'Musician'}
                          </span>
                          {dist && <><span>•</span><span>{dist} away</span></>}
                        </div>
                      </div>
                      <span className={`badge ${style.badge} shadow-lg`}>{style.label}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2 relative z-10">
                      <span className="flex items-center gap-1.5 text-[10px] text-muted font-bold uppercase tracking-widest">
                        <Clock size={12} />
                        {formatTimeAgo(req.created_at)}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-black text-white group">
                         Details <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Persistent CTA */}
      <div className="fixed bottom-8 right-8 z-[100]">
         <button onClick={() => navigate('/create-request')} className="w-16 h-16 bg-white text-black rounded-full shadow-2xl flex items-center justify-center border-4 border-black active-press">
            <Zap size={28} className="fill-black" />
         </button>
      </div>

    </div>
  );
};

export default Feed;
