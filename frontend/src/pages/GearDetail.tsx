import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Package, Tag, DollarSign, Handshake,
  Gift, ShoppingCart, Trash2, Loader2, AlertTriangle,
} from 'lucide-react';
import { apiClient } from '../api/client';

interface GearItem {
  id:          string;
  name:        string;
  category:    string;
  description: string | null;
  brand:       string | null;
  model:       string | null;
  photo_urls:  string[];
  can_rent:    boolean;
  can_lend:    boolean;
  can_sell:    boolean;
  rent_price:  number | null;
  sell_price:  number | null;
  status:      'available' | 'lent_out' | 'unavailable';
  condition:   'mint' | 'good' | 'fair' | 'worn' | null;
  tags:        string[];
}

const CONDITION_LABEL: Record<string, { label: string; color: string }> = {
  mint: { label: 'Mint',  color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  good: { label: 'Good',  color: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/30' },
  fair: { label: 'Fair',  color: 'text-urgency-soon bg-urgency-soon/10 border-urgency-soon/30' },
  worn: { label: 'Worn',  color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  available:   { label: 'Available',   color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  lent_out:    { label: 'Lent Out',    color: 'text-urgency-soon bg-urgency-soon/10 border-urgency-soon/30' },
  unavailable: { label: 'Unavailable', color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
};

const GearDetail = () => {
  const navigate        = useNavigate();
  const { id }          = useParams<{ id: string }>();
  const [item, setItem] = useState<GearItem | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    if (!id) return;
    apiClient.get(`/gear/${id}`)
      .then(res => setItem(res.data.item))
      .catch(() => setError('Could not load gear item.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/gear/${id}`);
      navigate('/inventory', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not delete item. Try again.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-primary">
        <Loader2 size={36} className="animate-spin text-accent-cyan" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 px-6 bg-bg-primary">
        <p className="text-secondary text-center">{error || 'Item not found.'}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-accent-cyan">Go back</button>
      </div>
    );
  }

  const photo     = item.photo_urls?.[0] ?? null;
  const condition = item.condition ? CONDITION_LABEL[item.condition] : null;
  const status    = STATUS_LABEL[item.status];

  return (
    <div className="flex flex-col min-h-full bg-bg-primary animate-slide-up">

      {/* Photo / Hero */}
      <div className="relative h-64 bg-bg-secondary flex items-center justify-center overflow-hidden">
        {photo ? (
          <img src={photo} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-30">
            <Package size={64} className="text-gray-500" />
            <span className="text-xs text-gray-500 uppercase tracking-widest">No photo</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-transparent to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-gray-700 z-10"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>

        {/* Status badge */}
        <div className="absolute top-4 right-4 z-10">
          <span className={`badge border ${status.color}`}>{status.label}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-4 pb-28">

        {/* Name + category */}
        <div className="mb-1">
          <span className="text-xs text-muted uppercase tracking-widest">
            {item.category.replace('_', ' ')}
          </span>
        </div>
        <h1 className="text-2xl font-extrabold mb-1">{item.name}</h1>

        {/* Brand / Model */}
        {(item.brand || item.model) && (
          <p className="text-secondary text-sm mb-4">
            {[item.brand, item.model].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Condition */}
        {condition && (
          <div className="mb-4">
            <span className={`badge border ${condition.color}`}>
              {condition.label} condition
            </span>
          </div>
        )}

        {/* Description */}
        {item.description && (
          <div className="glass-panel mb-4">
            <p className="text-sm text-secondary leading-relaxed">{item.description}</p>
          </div>
        )}

        {/* Availability options */}
        <div className="glass-panel mb-4 space-y-3">
          <p className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Availability</p>

          {item.can_lend && (
            <div className="flex items-center gap-3">
              <Gift size={18} className="text-accent-cyan shrink-0" />
              <span className="text-sm font-medium">Available to lend (free)</span>
            </div>
          )}

          {item.can_rent && (
            <div className="flex items-center gap-3">
              <Handshake size={18} className="text-urgency-soon shrink-0" />
              <span className="text-sm font-medium">
                Available to rent
                {item.rent_price != null && (
                  <span className="text-muted"> · ${item.rent_price}/day</span>
                )}
              </span>
            </div>
          )}

          {item.can_sell && (
            <div className="flex items-center gap-3">
              <ShoppingCart size={18} className="text-urgency-emergency shrink-0" />
              <span className="text-sm font-medium">
                For sale
                {item.sell_price != null && (
                  <span className="text-muted"> · ${item.sell_price}</span>
                )}
              </span>
            </div>
          )}

          {!item.can_lend && !item.can_rent && !item.can_sell && (
            <p className="text-sm text-muted">No availability options set.</p>
          )}
        </div>

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {item.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-full bg-bg-secondary border border-bg-glass-border text-xs text-secondary">
                <Tag size={10} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Delete button — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pt-4 bg-gradient-to-t from-bg-primary to-transparent" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-red-500/40 text-urgency-emergency font-bold hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={18} />
            Remove from Inventory
          </button>
        ) : (
          <div className="glass-panel border border-red-500/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-urgency-emergency">
              <AlertTriangle size={18} />
              <p className="text-sm font-bold">Remove this item?</p>
            </div>
            <p className="text-xs text-secondary">
              This will permanently delete <span className="text-white font-semibold">{item.name}</span> from your inventory.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-xl border border-bg-glass-border text-secondary font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-urgency-emergency text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default GearDetail;
