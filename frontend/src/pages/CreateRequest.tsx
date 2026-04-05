import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { apiClient } from '../api/client';
import { getSavedCoords } from './Home';

const URGENCY_OPTIONS = [
  { value: 'normal',    label: 'Normal',    color: 'border-blue-500/40 text-blue-400'  },
  { value: 'soon',      label: 'Soon',      color: 'border-urgency-soon text-urgency-soon' },
  { value: 'urgent',    label: 'Urgent',    color: 'border-urgency-urgent text-urgency-urgent' },
  { value: 'emergency', label: 'Emergency', color: 'border-urgency-emergency text-urgency-emergency' },
];

const CATEGORIES = [
  'cables','microphones','speakers','stands','pedals',
  'instruments','lighting','dj_gear','power','adapters','accessories',
];

const CreateRequest = () => {
  const navigate = useNavigate();

  const [step, setStep]           = useState<'form' | 'processing' | 'done'>('form');
  const [error, setError]         = useState('');

  // Form fields
  const [equipment, setEquipment] = useState('');
  const [category, setCategory]   = useState('accessories');
  const [urgency, setUrgency]     = useState('urgent');
  const [notes, setNotes]         = useState('');

  // Result
  const [result, setResult]       = useState<{ id: string; equipment: string; urgency: string } | null>(null);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!equipment.trim()) return;
    setStep('processing');
    setError('');

    const { lat, lng } = getSavedCoords();

    try {
      // Try AI parse first — it gives better equipment name / category detection
      const { data } = await apiClient.post('/requests/parse', {
        raw_text:         equipment.trim(),
        lat,
        lng,
        search_radius_km: 10,
        urgency,          // user-set urgency overrides AI
      });

      setResult({
        id:        data.request.id,
        equipment: data.ai_parse?.equipment || equipment.trim(),
        urgency:   data.request.urgency,
      });
      setStep('done');

    } catch (aiErr: any) {
      // AI parse failed — fall back to structured request
      try {
        const { data } = await apiClient.post('/requests', {
          equipment: equipment.trim(),
          category,
          urgency,
          lat,
          lng,
          search_radius_km: 10,
          notes: notes.trim() || undefined,
        });

        setResult({
          id:        data.request.id,
          equipment: data.request.equipment,
          urgency:   data.request.urgency,
        });
        setStep('done');

      } catch (err: any) {
        setError(err.response?.data?.error || 'Could not create request. Check your connection.');
        setStep('form');
      }
    }
  };

  if (step === 'processing') {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-bg-primary px-6">
        <Loader2 size={48} className="text-accent-cyan animate-spin mb-4" />
        <h2 className="text-xl font-bold mb-2">Broadcasting Request...</h2>
        <p className="text-secondary text-center text-sm">Finding nearby matches.</p>
      </div>
    );
  }

  if (step === 'done' && result) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-bg-primary px-6 gap-6">
        <div className="w-24 h-24 rounded-full bg-urgency-emergency/20 border border-urgency-emergency/40 flex items-center justify-center">
          <CheckCircle2 size={48} className="text-urgency-emergency" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold mb-2">Request Live!</h1>
          <p className="text-secondary text-sm">Your request is now visible to nearby musicians.</p>
        </div>
        <div className="glass-panel w-full space-y-3">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Equipment</p>
            <p className="text-lg font-bold">{result.equipment}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Urgency</p>
            <span className={`badge ${result.urgency === 'emergency' ? 'badge-emergency' : result.urgency === 'urgent' ? 'badge-urgent' : result.urgency === 'soon' ? 'badge-soon' : 'badge-normal'} capitalize`}>
              {result.urgency}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate('/requests', { replace: true })}
          className="w-full btn-emergency py-4 text-lg shadow-none"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 8px 32px rgba(16,185,129,0.3)' }}
        >
          <Zap size={20} /> Go to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary pt-6 px-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate(-1)} className="text-muted hover:text-white">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">New Request</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-urgency-emergency">
            {error}
          </div>
        )}

        {/* Equipment */}
        <div>
          <label className="text-xs text-muted uppercase tracking-widest font-bold mb-2 block">
            What do you need? *
          </label>
          <input
            type="text"
            autoFocus
            value={equipment}
            onChange={e => setEquipment(e.target.value)}
            placeholder="e.g. SM58 mic, XLR cable, 9V battery..."
            className="w-full bg-bg-secondary border border-bg-glass-border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 outline-none transition-all"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-muted uppercase tracking-widest font-bold mb-2 block">
            Category
          </label>
          <div className="relative">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full appearance-none bg-bg-secondary border border-bg-glass-border rounded-xl px-4 py-3.5 text-sm text-white focus:border-accent-cyan outline-none transition-all capitalize pr-10"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c} className="bg-gray-900 capitalize">
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Urgency */}
        <div>
          <label className="text-xs text-muted uppercase tracking-widest font-bold mb-2 block">
            Urgency
          </label>
          <div className="grid grid-cols-4 gap-2">
            {URGENCY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUrgency(opt.value)}
                className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  urgency === opt.value
                    ? `${opt.color} bg-white/5`
                    : 'border-bg-glass-border text-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-muted uppercase tracking-widest font-bold mb-2 block">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any extra details... venue, specific model, etc."
            rows={3}
            className="w-full bg-bg-secondary border border-bg-glass-border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-accent-cyan outline-none transition-all resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!equipment.trim()}
          className="mt-auto mb-8 w-full btn-emergency py-4 text-lg shadow-none disabled:opacity-40"
        >
          <ArrowRight size={20} /> Broadcast Request
        </button>
      </form>
    </div>
  );
};

export default CreateRequest;
