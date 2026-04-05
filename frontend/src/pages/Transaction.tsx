import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck, Package, MessageSquare, Loader2,
  CheckCircle, XCircle, Clock, AlertTriangle, User, ArrowLeft,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../store/AuthContext';

interface LocationState {
  requestId?:    string;
  gearItemId?:   string;
  borrowerId?:   string;
  equipment?:    string;
  gearName?:     string;
  transactionId?: string;
  agreedPrice?:  number;
  type?:         string;
  notes?:        string;
}

interface TxData {
  id:            string;
  status:        'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
  type:          string;
  agreed_price:  number | null;
  gear_name?:    string;
  lender_name?:  string;
  borrower_name?: string;
  lender_id:     string;
  borrower_id:   string;
  request_id?:   string;
  notes?:        string;
}

const STATUS_CONFIG = {
  pending:   { label: 'Awaiting Confirmation',  color: 'text-yellow-400',  bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  active:    { label: 'In Progress',            color: 'text-green-400',   bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  completed: { label: 'Completed',              color: 'text-accent-cyan', bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20'   },
  cancelled: { label: 'Cancelled',              color: 'text-red-400',     bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
  disputed:  { label: 'Disputed',               color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
};

const Transaction = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const state     = (location.state as LocationState) ?? {};

  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');
  const [txId, setTxId]               = useState<string | null>(state.transactionId || null);
  const [isCreating, setIsCreating]   = useState(false);
  const [txData, setTxData]           = useState<TxData | null>(null);
  const createdRef                    = useRef(false);

  // Auto-create or fetch
  useEffect(() => {
    const init = async () => {
      // Create new transaction if we have the params and haven't created yet
      if (!txId && state.requestId && state.gearItemId && !createdRef.current) {
        createdRef.current = true;
        setIsCreating(true);
        try {
          const { data } = await apiClient.post('/transactions', {
            request_id:   state.requestId,
            gear_item_id: state.gearItemId,
            borrower_id:  state.borrowerId,
            type:         state.type || 'loan',
            agreed_price: state.agreedPrice ?? 0,
            notes:        state.notes,
          });
          setTxId(data.transaction.id);
        } catch (err: any) {
          setError(err.response?.data?.error || 'Could not initiate transaction.');
          setIsCreating(false);
        }
        return;
      }

      // Fetch existing transaction
      if (txId) {
        try {
          const res = await apiClient.get(`/transactions/${txId}`);
          setTxData(res.data.transaction);
        } catch {
          setError('Could not load transaction details.');
        }
      }
    };
    init();
  }, [txId]);

  // Once txId is set after creation, fetch the data
  useEffect(() => {
    if (txId && isCreating === false && !txData) {
      apiClient.get(`/transactions/${txId}`)
        .then(res => setTxData(res.data.transaction))
        .catch(() => setError('Could not load transaction details.'))
        .finally(() => setIsCreating(false));
    }
  }, [txId, isCreating]);

  const updateStatus = async (newStatus: string) => {
    if (!txId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.patch(`/transactions/${txId}`, { status: newStatus });
      setTxData(res.data.transaction);

      if (newStatus === 'completed') {
        navigate('/rating', {
          state: {
            transactionId: txId,
            equipment: txData?.gear_name || state.gearName || state.equipment || 'Gear',
          },
        });
      } else if (newStatus === 'cancelled') {
        navigate(-1);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCreating || (!txData && !error)) return (
    <div className="flex flex-col h-full items-center justify-center bg-bg-primary gap-4">
      <Loader2 size={40} className="animate-spin text-accent-cyan" />
      <p className="text-secondary font-medium">
        {isCreating ? 'Securing transaction...' : 'Loading deal...'}
      </p>
    </div>
  );

  const isLender   = txData?.lender_id === user?.id;
  const gearName   = txData?.gear_name || state.gearName || state.equipment || 'Gear Item';
  const status     = txData?.status ?? 'pending';
  const statusConf = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const otherName  = isLender ? (txData?.borrower_name || 'Borrower') : (txData?.lender_name || 'Lender');

  return (
    <div className="flex flex-col h-full bg-bg-primary pt-safe">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-black">Deal Details</h1>
          <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
            {isLender ? 'You are lending' : 'You are borrowing'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 space-y-4">

        {/* Status Banner */}
        <div className={`rounded-3xl border p-4 flex items-center gap-3 ${statusConf.bg} ${statusConf.border}`}>
          <ShieldCheck size={22} className={statusConf.color} />
          <div>
            <p className={`text-sm font-black ${statusConf.color}`}>{statusConf.label}</p>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Pulse Protocol Active</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400 font-medium flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Gear Info */}
        <div className="glass-panel space-y-5 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shrink-0">
              <Package size={22} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-0.5">Gear</p>
              <p className="text-base font-bold">{gearName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shrink-0">
              <User size={22} className="text-accent-cyan" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-0.5">
                {isLender ? 'Borrower' : 'Lender'}
              </p>
              <p className="text-base font-bold">{otherName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shrink-0">
              <Clock size={22} className="text-urgency-soon" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-0.5">Type</p>
              <p className="text-base font-bold capitalize">{txData?.type || state.type || 'loan'}</p>
            </div>
          </div>

          {(txData?.agreed_price != null && txData.agreed_price > 0) && (
            <div className="pt-4 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-muted font-bold uppercase tracking-widest">Agreed Price</span>
              <span className="text-xl font-black text-green-400">${txData.agreed_price}</span>
            </div>
          )}
        </div>

        {/* Role-specific guidance */}
        {status === 'pending' && (
          <div className={`glass-panel py-4 ${isLender ? 'border-yellow-500/20' : 'border-green-500/20'}`}>
            <p className="text-sm text-secondary leading-relaxed text-center">
              {isLender
                ? `Waiting for ${otherName} to confirm. You can cancel if they don't respond.`
                : `${otherName} wants to lend you ${gearName}. Confirm to start the deal.`}
            </p>
          </div>
        )}

        {status === 'active' && (
          <div className="glass-panel py-4 border-green-500/20">
            <p className="text-sm text-secondary leading-relaxed text-center">
              Deal is live. Coordinate the handoff via chat, then mark complete when done.
            </p>
          </div>
        )}

        {/* Transaction ID */}
        <p className="text-center text-[10px] text-muted font-bold tracking-[0.2em] opacity-40 uppercase">
          ID: {txId?.slice(0, 8)} · Identity & Gear Verified
        </p>
      </div>

      {/* Action Buttons */}
      {(status === 'pending' || status === 'active') && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pb-10 pt-4 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent space-y-3 z-50">

          {/* Primary action */}
          {status === 'pending' && !isLender && (
            <button
              onClick={() => updateStatus('active')}
              disabled={isLoading}
              className="w-full bg-green-500 text-black font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base shadow-2xl shadow-green-500/20 disabled:opacity-40 active:scale-95 transition-all"
            >
              {isLoading ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
              {isLoading ? 'Confirming...' : 'Confirm & Start Deal'}
            </button>
          )}

          {status === 'pending' && isLender && (
            <button
              disabled
              className="w-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base opacity-60"
            >
              <Clock size={22} /> Waiting for Confirmation...
            </button>
          )}

          {status === 'active' && (
            <button
              onClick={() => updateStatus('completed')}
              disabled={isLoading}
              className="w-full bg-white text-black font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base shadow-2xl shadow-white/10 disabled:opacity-40 active:scale-95 transition-all"
            >
              {isLoading ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
              {isLoading ? 'Confirming...' : 'Handoff Complete'}
            </button>
          )}

          {/* Secondary: Chat */}
          <div className="flex gap-3">
            {txData?.request_id && (
              <button
                onClick={() => navigate(`/chat/${txData.request_id}`, { state: { recipientId: isLender ? txData.borrower_id : txData.lender_id } })}
                className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl py-3.5 text-sm font-bold"
              >
                <MessageSquare size={16} /> Chat
              </button>
            )}
            <button
              onClick={() => updateStatus('cancelled')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl py-3.5 text-sm font-bold text-red-400 disabled:opacity-40"
            >
              <XCircle size={16} /> Cancel Deal
            </button>
          </div>

        </div>
      )}

      {/* Completed / Cancelled states */}
      {(status === 'completed' || status === 'cancelled') && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pb-10 pt-4 z-50">
          <button
            onClick={() => navigate('/requests')}
            className="w-full bg-white/10 border border-white/10 text-white font-black py-4 rounded-2xl"
          >
            Back to Feed
          </button>
        </div>
      )}
    </div>
  );
};

export default Transaction;
