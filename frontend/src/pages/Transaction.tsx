import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck, Package, MessageSquare, Loader2,
  CheckCircle, XCircle, Clock, AlertTriangle, User, ArrowLeft,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../store/AuthContext';

interface LocationState {
  requestId?:     string;
  gearItemId?:    string;
  borrowerId?:    string;
  equipment?:     string;
  gearName?:      string;
  transactionId?: string;
  agreedPrice?:   number;
  type?:          string;
  notes?:         string;
}

interface TxData {
  id:             string;
  status:         'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
  type:           string;
  agreed_price:   number | null;
  gear_name?:     string;
  lender_name?:   string;
  borrower_name?: string;
  lender_id:      string;
  borrower_id:    string;
  request_id?:    string;
  notes?:         string;
}

const STATUS_CONFIG = {
  pending:   { label: 'Awaiting Confirmation', color: 'text-yellow-400',  bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  active:    { label: 'In Progress',           color: 'text-green-400',   bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  completed: { label: 'Completed',             color: 'text-accent-cyan', bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20'   },
  cancelled: { label: 'Cancelled',             color: 'text-red-400',     bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
  disputed:  { label: 'Disputed',              color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
};

const Transaction = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state    = (location.state as LocationState) ?? {};

  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMsg, setLoadingMsg] = useState('Loading deal...');
  const [error, setError]           = useState('');
  const [txId, setTxId]             = useState<string | null>(state.transactionId ?? null);
  const [txData, setTxData]         = useState<TxData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const didInit = useRef(false);

  const fetchTx = async (id: string) => {
    const res = await apiClient.get(`/transactions/${id}`);
    setTxData(res.data.transaction);
    setPageStatus('ready');
  };

  // Single init effect — runs once on mount
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      try {
        // Case 1: viewing an existing transaction
        if (state.transactionId) {
          setLoadingMsg('Loading deal...');
          await fetchTx(state.transactionId);
          return;
        }

        // Case 2: creating a new transaction (lender responding to a request)
        if (state.requestId && state.gearItemId) {
          setLoadingMsg('Securing transaction...');
          const { data } = await apiClient.post('/transactions', {
            request_id:   state.requestId,
            gear_item_id: state.gearItemId,
            borrower_id:  state.borrowerId,
            type:         state.type || 'loan',
            agreed_price: state.agreedPrice ?? 0,
            notes:        state.notes,
          });
          const newId = data.transaction.id;
          setTxId(newId);
          setLoadingMsg('Loading deal...');
          await fetchTx(newId);
          return;
        }

        // No valid state — nothing to show
        setError('No transaction data found. Please go back and try again.');
        setPageStatus('error');
      } catch (err: any) {
        const msg = err.response?.data?.error || 'Something went wrong. Please try again.';
        setError(msg);
        setPageStatus('error');
      }
    };

    init();
  }, []);

  const updateStatus = async (newStatus: string) => {
    const id = txId ?? txData?.id;
    if (!id) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await apiClient.patch(`/transactions/${id}`, { status: newStatus });
      const updated = res.data.transaction;
      setTxData(updated);

      if (newStatus === 'completed') {
        navigate('/rating', {
          state: {
            transactionId: id,
            equipment: txData?.gear_name || state.gearName || state.equipment || 'Gear',
          },
        });
      } else if (newStatus === 'cancelled') {
        navigate(-1);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action failed. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (pageStatus === 'loading') {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-bg-primary gap-4">
        <Loader2 size={40} className="animate-spin text-accent-cyan" />
        <p className="text-secondary font-medium">{loadingMsg}</p>
      </div>
    );
  }

  // ── Hard error (couldn't load at all) ────────────────────────────────────────
  if (pageStatus === 'error' || !txData) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-bg-primary gap-6 px-8">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-secondary text-center font-medium">{error || 'Could not load transaction.'}</p>
        <button onClick={() => navigate(-1)} className="text-sm font-black text-accent-cyan underline underline-offset-4">Go Back</button>
      </div>
    );
  }

  // ── Ready ────────────────────────────────────────────────────────────────────
  const isLender   = txData.lender_id === user?.id;
  const gearName   = txData.gear_name || state.gearName || state.equipment || 'Gear Item';
  const status     = txData.status;
  const statusConf = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const otherName  = isLender ? (txData.borrower_name || 'Borrower') : (txData.lender_name || 'Lender');
  const canAct     = status === 'pending' || status === 'active';

  return (
    <div className="flex flex-col h-full bg-bg-primary">

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

      <div className="flex-1 overflow-y-auto px-4 pb-48 space-y-4">

        {/* Status banner */}
        <div className={`rounded-3xl border p-4 flex items-center gap-3 ${statusConf.bg} ${statusConf.border}`}>
          <ShieldCheck size={22} className={statusConf.color} />
          <div>
            <p className={`text-sm font-black ${statusConf.color}`}>{statusConf.label}</p>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Pulse Protocol Active</p>
          </div>
        </div>

        {/* Inline error (action failures) */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400 font-medium flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Deal info card */}
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
              <p className="text-base font-bold capitalize">{txData.type}</p>
            </div>
          </div>

          {txData.agreed_price != null && txData.agreed_price > 0 && (
            <div className="pt-4 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-muted font-bold uppercase tracking-widest">Agreed Price</span>
              <span className="text-xl font-black text-green-400">${txData.agreed_price}</span>
            </div>
          )}
        </div>

        {/* Context message */}
        {status === 'pending' && (
          <p className="text-sm text-secondary text-center px-4 leading-relaxed">
            {isLender
              ? `Waiting for ${otherName} to confirm. You can cancel if they don't respond.`
              : `${otherName} wants to lend you ${gearName}. Confirm to start the deal.`}
          </p>
        )}
        {status === 'active' && (
          <p className="text-sm text-secondary text-center px-4 leading-relaxed">
            Deal is live. Coordinate the meetup via chat, then mark complete once the gear changes hands.
          </p>
        )}

        <p className="text-center text-[10px] text-muted font-bold tracking-[0.2em] opacity-40 uppercase pt-2">
          ID: {txData.id.slice(0, 8)} · Identity & Gear Verified
        </p>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────────────── */}
      {canAct && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pb-10 pt-4 bg-gradient-to-t from-bg-primary via-bg-primary to-transparent space-y-3 z-50">

          {/* Primary CTA */}
          {status === 'pending' && !isLender && (
            <button
              onClick={() => updateStatus('active')}
              disabled={actionLoading}
              className="w-full bg-green-500 text-black font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base shadow-2xl shadow-green-500/20 disabled:opacity-50 active:scale-95 transition-all"
            >
              {actionLoading ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
              {actionLoading ? 'Confirming...' : 'Confirm & Start Deal'}
            </button>
          )}

          {status === 'pending' && isLender && (
            <div className="w-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base">
              <Clock size={22} /> Waiting for {otherName}...
            </div>
          )}

          {status === 'active' && (
            <button
              onClick={() => updateStatus('completed')}
              disabled={actionLoading}
              className="w-full bg-white text-black font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base shadow-2xl shadow-white/10 disabled:opacity-50 active:scale-95 transition-all"
            >
              {actionLoading ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
              {actionLoading ? 'Confirming...' : 'Handoff Complete'}
            </button>
          )}

          {/* Secondary row: Chat + Cancel */}
          <div className="flex gap-3">
            {txData.request_id && (
              <button
                onClick={() => navigate(`/chat/${txData.request_id}`, {
                  state: { recipientId: isLender ? txData.borrower_id : txData.lender_id },
                })}
                className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl py-4 text-sm font-bold"
              >
                <MessageSquare size={16} /> Chat
              </button>
            )}
            <button
              onClick={() => updateStatus('cancelled')}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl py-4 text-sm font-bold text-red-400 disabled:opacity-50"
            >
              <XCircle size={16} /> Cancel Deal
            </button>
          </div>
        </div>
      )}

      {/* Finished states */}
      {!canAct && (
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
