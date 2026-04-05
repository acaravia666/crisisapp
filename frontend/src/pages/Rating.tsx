import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, CheckCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';

interface LocationState {
  requestId?:     string;
  transactionId?: string;
  equipment?:     string;
}

const Rating = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { equipment, transactionId } =
    (location.state as LocationState) ?? {};

  const [rating, setRating]     = useState(0);
  const [comment, setComment]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    setError('');

    try {
      // Only submit to API if we have a real transaction ID
      if (transactionId) {
        await apiClient.post('/reviews', {
          transaction_id: transactionId,
          rating,
          comment: comment.trim() || undefined,
        });
      }
      navigate('/requests', { replace: true });
    } catch (err: any) {
      // Reviews fail silently — still navigate to feed
      navigate('/requests', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-slide-up bg-bg-primary pt-6 px-4">
      <div className="flex-1 flex flex-col justify-center items-center">

        <div className="w-24 h-24 mx-auto rounded-full border-4 border-green-500/40 overflow-hidden mb-6 flex items-center justify-center bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
          <CheckCircle size={40} className="text-green-500" />
        </div>

        <h1 className="text-3xl font-extrabold text-center mb-2">Rescue Complete!</h1>
        <p className="text-secondary text-center mb-2">
          {equipment ?? 'Gear'} delivered successfully.
        </p>
        <p className="text-secondary text-center mb-10 text-sm">
          How was the experience?
        </p>

        {/* Stars */}
        <div className="flex gap-3 mb-10">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="focus:outline-none transition-transform hover:scale-110 active-press"
            >
              <Star
                size={48}
                className={
                  rating >= star
                    ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]'
                    : 'text-gray-700'
                }
              />
            </button>
          ))}
        </div>

        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <div className="w-full relative glass-panel mb-8">
          <textarea
            className="w-full h-24 bg-transparent text-sm font-medium outline-none text-white resize-none placeholder-gray-600"
            placeholder="Leave a quick review (optional)..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        </div>
      </div>

      <button
        disabled={rating === 0 || loading}
        onClick={handleSubmit}
        className={`mt-auto mb-8 py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all ${
          rating > 0 && !loading
            ? 'bg-accent-cyan text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading
          ? <Loader2 size={20} className="animate-spin" />
          : <CheckCircle size={20} />
        }
        {loading ? 'Submitting...' : 'Submit & Go to Feed'}
      </button>
    </div>
  );
};

export default Rating;
