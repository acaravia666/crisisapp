import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck, Package, MessageSquare, Loader2,
  CheckCircle, XCircle, Clock, AlertTriangle, User, ArrowLeft,
  CalendarClock, RotateCcw, DollarSign, TrendingUp,
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
  started_at?:    string | null;
  ended_at?:      string | null;
}

// Parse "Duration: 10 days" or "Duration: 4 hours" from notes
function parseDuration(notes?: string | null): { value: number; unit: 'hours' | 'days' } | null {
  if (!notes) return null;
  const m = notes.match(/Duration:\s*(\d+)\s*(hour|day)/i);
  if (!m) return null;
  return { value: parseInt(m[1]), unit: m[2].toLowerCase().startsWith('h') ? 'hours' : 'days' };
}

function addDuration(date: Date, dur: { value: number; unit: 'hours' | 'days' }): Date {
  const ms = dur.unit === 'hours'
    ? dur.value * 3600_000
    : dur.value * 86_400_000;
  return new Date(date.getTime() + ms);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysRemaining(returnDate: Date): number {
  return Math.ceil((returnDate.getTime() - Date.now()) / 86_400_000);
}

const STATUS_CONFIG = {
  pending:   { label: 'Awaiting Confirmation', color: 'text-yellow-400',  bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  active:    { label: 'Rental Active',          color: 'text-green-400',   bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  completed: { label: 'Completed',              color: 'text-accent-cyan', bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20'   },
  cancelled: { label: 'Cancelled',              color: 'text-red-400',     bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
  disputed:  { label: 'Disputed',               color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
};

const Transaction = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state    = (location.state as LocationState) ?? {};

  const [pageStatus, setPageStatus]       = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMsg, setLoadingMsg]       = useState('Loading deal...');
  const [error, setError]                 = useState('');
  const [txId, setTxId]                   = useState<string | null>(state.transactionId ?? null);
  const [txData, setTxData]               = useState<TxData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const didInit = useRef(false);

  const fetchTx = async (id: string) => {
    const res = await apiClient.get(`/transactions/${id}`);
    setTxData(res.data.transaction);
    setPageStatus('ready');
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      try {
        if (state.transactionId) {
          await fetchTx(state.transactionId);
          return;
        }
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
        setError('No transaction data found. Please go back and try again.');
        setPageStatus('error');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Something went wrong. Please try again.');
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
      setTxData(res.data.transaction);

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

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (pageStatus === 'loading') {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-bg-primary gap-4">
        <Loader2 size={40} className="animate-spin text-accent-cyan" />
        <p className="text-secondary font-medium">{loadingMsg}</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (pageStatus === 'error' || !txData) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-bg-primary gap-6 px-8">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-secondary text-center font-medium">{error || 'Could not load transaction.'}</p>
        <button onClick={() => navigate(-1)} className="text-sm font-black text-accent-cyan underline underline-offset-4">Go Back</button>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const isLender    = txData.lender_id === user?.id;
  const gearName    = txData.gear_name || state.gearName || state.equipment || 'Gear Item';
  const status      = txData.status;
  const statusConf  = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const otherName   = isLender ? (txData.borrower_name || 'Borrower') : (txData.lender_name || 'Lender');
  const canAct      = status === 'pending' || status === 'active';
  const isRental    = txData.type === 'rental' || txData.type === 'loan';

  // Rental period calculations
  const duration    = parseDuration(txData.notes);
  const startedAt   = txData.started_at ? new Date(txData.started_at) : null;
  const returnDate  = startedAt && duration ? addDuration(startedAt, duration) : null;
  const daysLeft    = returnDate ? daysRemaining(returnDate) : null;
  const totalCost   = (txData.agreed_price && duration)
    ? txData.agreed_price * duration.value
    : txData.agreed_price ?? 0;
  const progressPct = (startedAt && returnDate && duration)
    ? Math.min(100, Math.max(0, ((Date.now() - startedAt.getTime()) / (returnDate.getTime() - startedAt.getTime())) * 100))
    : 0;

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

      <div className="flex-1 overflow-y-auto px-4 pb-52 space-y-4">

        {/* Status banner */}
        <div className={`rounded-3xl border p-4 flex items-center gap-3 ${statusConf.bg} ${statusConf.border}`}>
          <ShieldCheck size={22} className={statusConf.color} />
          <div>
            <p className={`text-sm font-black ${statusConf.color}`}>{statusConf.label}</p>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Pulse Protocol Active</p>
          </div>
        </div>

        {/* Inline error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400 font-medium flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Base deal info */}
        <div className="glass-panel space-y-4 py-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shrink-0">
              <Package size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-0.5">Gear</p>
              <p className="text-base font-bold">{gearName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shrink-0">
              <User size={20} className="text-accent-cyan" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-0.5">
                {isLender ? 'Borrower' : 'Lender'}
              </p>
              <p className="text-base font-bold">{otherName}</p>
            </div>
          </div>
        </div>

        {/* ── RENTAL PERIOD CARD (active rental) ─────────────────────────────── */}
        {status === 'active' && isRental && (
          <div className="glass-panel border-green-500/20 space-y-4 py-5 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-green-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                <CalendarClock size={12} /> Rental Period
              </p>
              {daysLeft !== null && (
                <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                  daysLeft < 0
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : daysLeft <= 1
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                    : 'bg-green-500/10 border-green-500/30 text-green-400'
                }`}>
                  {daysLeft < 0
                    ? `${Math.abs(daysLeft)}d overdue`
                    : daysLeft === 0
                    ? 'Due today'
                    : `${daysLeft}d left`}
                </span>
              )}
            </div>

            {/* Duration row */}
            {duration && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
                  <Clock size={16} className="text-muted" />
                </div>
                <div>
                  <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Duration</p>
                  <p className="text-sm font-bold">{duration.value} {duration.unit}</p>
                </div>
              </div>
            )}

            {/* Start / Return dates */}
            {startedAt && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
                  <CalendarClock size={16} className="text-accent-cyan" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Started</p>
                  <p className="text-sm font-bold">{formatDate(startedAt)}</p>
                </div>
                {returnDate && (
                  <div className="text-right">
                    <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Return by</p>
                    <p className={`text-sm font-bold ${daysLeft !== null && daysLeft < 0 ? 'text-red-400' : ''}`}>
                      {formatDate(returnDate)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Progress bar */}
            {startedAt && returnDate && (
              <div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progressPct >= 100 ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Total cost */}
            {totalCost > 0 && (
              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-400" />
                  <span className="text-xs text-muted font-bold uppercase tracking-widest">Total Value</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-green-400">${totalCost.toFixed(0)}</span>
                  {duration && txData.agreed_price && (
                    <p className="text-[10px] text-muted font-bold">
                      ${txData.agreed_price}/{duration.unit === 'hours' ? 'hr' : 'day'} × {duration.value}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Simple price display for pending or non-rental */}
        {status !== 'active' && txData.agreed_price != null && txData.agreed_price > 0 && (
          <div className="glass-panel flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-green-400" />
              <span className="text-xs text-muted font-bold uppercase tracking-widest">
                {txData.type === 'rental' ? 'Rate' : 'Price'}
              </span>
            </div>
            <span className="text-lg font-black text-green-400">
              ${txData.agreed_price}
              {txData.type === 'rental' && duration
                ? `/${duration.unit === 'hours' ? 'hr' : 'day'}`
                : ''}
            </span>
          </div>
        )}

        {/* Context messages */}
        {status === 'pending' && (
          <p className="text-sm text-secondary text-center px-4 leading-relaxed">
            {isLender
              ? `Waiting for ${otherName} to confirm. You can cancel if they don't respond.`
              : `${otherName} is offering you ${gearName}. Confirm to start the deal and the rental clock.`}
          </p>
        )}

        {status === 'active' && (
          <div className={`glass-panel py-4 ${isLender ? 'border-green-500/20' : 'border-accent-cyan/20'}`}>
            <div className="flex items-start gap-3">
              <RotateCcw size={16} className={`mt-0.5 shrink-0 ${isLender ? 'text-green-400' : 'text-accent-cyan'}`} />
              <p className="text-sm text-secondary leading-relaxed">
                {isLender
                  ? `When ${otherName} brings back the gear, tap "Gear Returned" to close the deal and make it available again.`
                  : `Return the gear to ${otherName} by ${returnDate ? formatDate(returnDate) : 'the agreed date'}. Ask them to confirm the return.`}
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-muted font-bold tracking-[0.2em] opacity-40 uppercase pt-2">
          ID: {txData.id.slice(0, 8)} · Identity & Gear Verified
        </p>
      </div>

      {/* ── Action buttons ─────────────────────────────────────────────────────── */}
      {canAct && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pb-10 pt-4 bg-gradient-to-t from-bg-primary via-bg-primary to-transparent space-y-3 z-50">

          {/* Pending: borrower confirms */}
          {status === 'pending' && !isLender && (
            <button
              onClick={() => updateStatus('active')}
              disabled={actionLoading}
              className="w-full bg-green-500 text-black font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base shadow-2xl shadow-green-500/20 disabled:opacity-50 active:scale-95 transition-all"
            >
              {actionLoading ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
              {actionLoading ? 'Confirming...' : 'Confirm & Start Rental'}
            </button>
          )}

          {/* Pending: lender waits */}
          {status === 'pending' && isLender && (
            <div className="w-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base">
              <Clock size={22} /> Waiting for {otherName}...
            </div>
          )}

          {/* Active: lender confirms return */}
          {status === 'active' && isLender && (
            <button
              onClick={() => updateStatus('completed')}
              disabled={actionLoading}
              className="w-full bg-white text-black font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-3 text-base shadow-2xl shadow-white/10 disabled:opacity-50 active:scale-95 transition-all"
            >
              {actionLoading ? <Loader2 size={22} className="animate-spin" /> : <RotateCcw size={22} />}
              {actionLoading ? 'Confirming...' : 'Gear Returned — Close Deal'}
            </button>
          )}

          {/* Active: borrower sees info (lender closes the deal) */}
          {status === 'active' && !isLender && (
            <div className="w-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan font-bold py-4 rounded-[2.5rem] flex items-center justify-center gap-2 text-sm px-4 text-center">
              <RotateCcw size={18} /> Return the gear · Ask {otherName} to close the deal
            </div>
          )}

          {/* Secondary: Chat + Cancel */}
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

      {/* Finished state */}
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
