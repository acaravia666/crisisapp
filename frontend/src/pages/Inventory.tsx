import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Loader2, X, ChevronRight, Camera, ImagePlus } from 'lucide-react';
import { apiClient } from '../api/client';

interface GearItem {
  id:       string;
  name:     string;
  category: string;
  status:   'available' | 'lent_out' | 'unavailable';
  photo_urls: string[];
}

const CATEGORIES = [
  'cables', 'microphones', 'speakers', 'stands', 'pedals',
  'instruments', 'lighting', 'dj_gear', 'power', 'adapters', 'accessories',
];

const Inventory = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems]       = useState<GearItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({ name: '', category: 'cables' });
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const fetchGear = async () => {
    try {
      const { data } = await apiClient.get('/gear/mine');
      setItems(data.items || []);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchGear(); }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const resetModal = () => {
    setForm({ name: '', category: 'cables' });
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormError('');
    setShowModal(false);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    setSaving(true);
    setFormError('');

    try {
      // 1. Upload photo if selected
      let photoUrl: string | undefined;
      if (photoFile) {
        const fd = new FormData();
        fd.append('file', photoFile);
        const { data: uploadData } = await apiClient.post('/uploads', fd, {
          headers: { 'Content-Type': undefined }, // let browser set multipart boundary automatically
        });
        photoUrl = uploadData.url;
      }

      // 2. Create gear item
      const { data } = await apiClient.post('/gear', {
        name:       form.name.trim(),
        category:   form.category,
        photo_urls: photoUrl ? [photoUrl] : [],
      });

      setItems(prev => [data.item, ...prev]);
      resetModal();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to add gear.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in pt-4">
      <div className="flex justify-between items-center mb-6 px-4">
        <h1 className="text-2xl font-bold">My Gear</h1>
      </div>

      <div className="flex-1 px-4 drop-shadow-lg pb-24 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="animate-spin text-accent-cyan" size={32} />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-secondary py-8">No gear added yet. Be the hero someone needs!</p>
        ) : (
          items.map(item => {
            const photo = item.photo_urls?.[0];
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/gear/${item.id}`)}
                className={`glass-panel p-0 overflow-hidden mb-4 cursor-pointer active-press card-lift ${item.status === 'lent_out' ? 'opacity-75' : ''}`}
              >
                <div className="flex items-center p-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mr-4 shrink-0 overflow-hidden">
                    {photo
                      ? <img src={photo} alt={item.name} className="w-full h-full object-cover" />
                      : <Package size={24} className="text-gray-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{item.name}</h3>
                    <p className="text-sm text-secondary capitalize">{item.category.replace('_', ' ')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-2">
                    {item.status === 'available'
                      ? <span className="badge badge-normal">Available</span>
                      : item.status === 'lent_out'
                      ? <span className="badge badge-soon">In Use</span>
                      : <span className="badge bg-gray-700/50 text-gray-400">Unavailable</span>
                    }
                    <ChevronRight size={16} className="text-muted" />
                  </div>
                </div>
                {item.status === 'lent_out' && (
                  <div className="bg-gray-800/80 px-4 py-2 text-xs text-center border-t border-gray-700/50 text-muted">
                    Currently lent out
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-28 right-4 w-14 h-14 bg-accent-cyan text-black rounded-full flex justify-center items-center shadow-lg hover:scale-105 transition-transform z-[110]"
        style={{ boxShadow: '0 4px 20px rgba(6, 182, 212, 0.4)' }}
      >
        <Plus size={28} />
      </button>

      {/* Add Gear Modal — full-screen via portal */}
      {showModal && createPortal(
        <>
          {/* Full-screen panel */}
          <div
            className="fixed inset-0 z-[120] bg-bg-primary flex flex-col animate-fade-in"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-6 pb-4 flex-shrink-0">
              <button onClick={resetModal} className="text-muted hover:text-white transition-colors">
                <X size={22} />
              </button>
              <h2 className="text-xl font-bold">Add Gear</h2>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto">
              <form onSubmit={handleAdd} className="flex flex-col gap-5 px-5 pb-6">

                {formError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-urgency-emergency">
                    {formError}
                  </div>
                )}

                {/* Photo picker */}
                <div>
                  <label className="text-xs text-muted uppercase tracking-widest font-bold mb-2 block">
                    Photo
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  {photoPreview ? (
                    <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-bg-glass-border">
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10"
                      >
                        <X size={14} className="text-white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10"
                      >
                        <Camera size={12} /> Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-36 rounded-2xl border-2 border-dashed border-bg-glass-border bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-muted hover:text-white hover:border-accent-cyan/40 hover:bg-accent-cyan/5 transition-all"
                    >
                      <ImagePlus size={30} />
                      <span className="text-sm font-semibold">Tap to add photo</span>
                      <span className="text-xs opacity-60">Optional</span>
                    </button>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs text-muted uppercase tracking-widest font-bold mb-2 block">
                    Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shure SM58 Microphone"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-bg-primary border border-bg-glass-border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 outline-none transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs text-muted uppercase tracking-widest font-bold mb-2 block">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full appearance-none bg-bg-primary border border-bg-glass-border rounded-xl px-4 py-3.5 text-sm text-white focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 outline-none transition-all capitalize pr-10"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-gray-900 capitalize">
                          {cat.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    {/* chevron */}
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-accent-cyan text-black font-bold py-4 rounded-xl flex justify-center items-center gap-2 disabled:opacity-60 transition-opacity text-sm"
                >
                  {saving
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Plus size={18} />
                  }
                  {saving ? (photoFile ? 'Uploading photo...' : 'Adding...') : 'Add to Inventory'}
                </button>
              </form>
            </div>
          </div>
        </>, document.body
      )}
    </div>
  );
};

export default Inventory;
