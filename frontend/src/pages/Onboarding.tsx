import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Zap, Guitar, LogIn } from 'lucide-react';

const Onboarding = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full animate-slide-up bg-bg-primary relative overflow-hidden">
      {/* DBG Badge */}
      <div 
        style={{ 
          position: 'absolute', top: '10px', right: '10px', zIndex: 1000,
          background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold',
          padding: '2px 8px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}
      >
        LIVE UPDATE ACTIVE
      </div>

      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-red-500/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex-1 flex flex-col justify-center px-6 relative z-10">
        <div className="mb-8 mt-12">
          <ShieldAlert size={64} className="text-urgency-emergency mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            The Show <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
              Must Go On.
            </span>
          </h1>
          <p className="text-lg text-secondary">
            Hyperlocal marketplace for emergency live-event equipment. Find what you need in seconds, not hours.
          </p>
        </div>

        <div className="space-y-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
              <Zap size={24} className="text-accent-cyan" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Instant Requests</h3>
              <p className="text-sm text-muted">AI-powered immediate gear matching.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
              <Guitar size={24} className="text-urgency-soon" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Local Musicians</h3>
              <p className="text-sm text-muted">Borrow, rent, or buy from people nearby.</p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-auto mb-8 flex flex-col gap-3">
          <button
            onClick={() => navigate('/signup')}
            className="btn-emergency shadow-[0_0_30px_rgba(239,68,68,0.4)]"
          >
            START NOW
          </button>

          <button
            onClick={() => navigate('/login')}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-bg-glass-border text-secondary font-bold hover:text-white hover:border-white/20 transition-colors"
          >
            <LogIn size={18} />
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
