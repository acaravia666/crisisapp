import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, MapPin, MessageSquare, Clock, Loader2, CheckCircle, Package } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';

interface LocationState {
  requestId?:    string;
  gearItemId?:   string;
  borrowerId?:   string;
  equipment?:    string;
  gearName?:     string;
  transactionId?: string;
}

const Transaction = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = (location.state as LocationState) ?? {};

  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');
  const [txId, setTxId]             = useState<string | null>(state.transactionId || null);
  const [isCreating, setIsCreating] = useState(false);
  const [txData, setTxData]         = useState<any>(null);
  const createdRef               = useRef(false);

  // Auto-create or fetch transaction
  useEffect(() => {
    const init = async () => {
      // 1. Create if we have create params
      if (!txId && state.requestId && state.gearItemId && !createdRef.current) {
        createdRef.current = true;
        setIsCreating(true);
        try {
          const { data } = await apiClient.post('/transactions', {
            request_id:   state.requestId,
            gear_item_id: state.gearItemId,
            borrower_id:  state.borrowerId,
            type:         'loan', 
          });
          setTxId(data.transaction.id);
        } catch (err: any) {
          setError(err.response?.data?.error || 'Could not initiate transaction.');
        } finally {
          setIsCreating(false);
        }
      } 
      // 2. Fetch data if we have an ID
      else if (txId) {
        apiClient.get(`/transactions/${txId}`).then(res => {
           setTxData(res.data.transaction);
        }).catch(() => setError('Could not load transaction details.'));
      }
    };
    init();
  }, [state, txId]);

  const handleHandoff = async () => {
    if (!txId) return;
    setIsLoading(true);
    setError('');
    try {
      await apiClient.patch(`/transactions/${txId}`, { status: 'completed' });
      navigate('/rating', { 
        state: { 
          transactionId: txId, 
          equipment: txData?.gear_name || state.gearName || state.equipment || 'Gear' 
        } 
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not complete handoff. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCreating) return (
    <div className="flex flex-col h-full items-center justify-center bg-bg-primary gap-4">
      <Loader2 size={40} className="animate-spin text-accent-cyan" />
      <p className="text-secondary font-medium">Securing transaction...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-slide-up bg-bg-primary pt-6 px-4">
      <div className="flex justify-center items-center mb-10 mt-12">
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.15)]">
           <ShieldCheck size={48} className="text-green-500" />
        </div>
      </div>

      <div className="text-center space-y-2 mb-10 px-6">
        <h1 className="text-4xl font-black">Deal Active</h1>
        <p className="text-secondary font-medium">Secured by Pulse Protocol</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400 mb-6 font-medium">
          {error}
        </div>
      )}

      <div className="glass-panel space-y-6 mb-8 py-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shrink-0"><Package size={22} className="text-white" /></div>
          <div className="flex-1">
             <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-0.5">Inventory Item</p>
             <p className="text-sm font-bold">{txData?.gear_name || state.gearName || state.equipment || 'Loading gear name...'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shrink-0"><MapPin size={22} className="text-urgency-soon" /></div>
          <div className="flex-1">
             <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-0.5">Meetup Zone</p>
             <p className="text-sm font-bold">Crisis Zone · Coordinate in Chat</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shrink-0"><Clock size={22} className="text-accent-cyan" /></div>
          <div className="flex-1">
             <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-0.5">Current Status</p>
             <p className="text-sm font-bold text-green-400">Awaiting Handoff</p>
          </div>
        </div>
      </div>

      <div className="mt-auto mb-10">
        <button
          onClick={handleHandoff}
          disabled={isLoading || !txId}
          className="w-full bg-white text-black font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-lg shadow-2xl shadow-white/5 disabled:opacity-40 transition-all active:scale-95"
        >
          {isLoading ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle size={24} />}
          {isLoading ? 'Confirming...' : 'Handoff Complete'}
        </button>
        <p className="text-center text-[10px] text-muted font-bold mt-4 uppercase tracking-[0.2em] opacity-40">Identity & Gear Verified · ID: {txId?.slice(0,8)}</p>
      </div>
    </div>
  );
};

export default Transaction;
