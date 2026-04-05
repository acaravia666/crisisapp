import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, UserPlus, Loader2 } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { apiClient } from '../api/client';

const Signup = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await apiClient.post('/auth/register', { name: name.trim(), email, password });
      login(data.accessToken, data.user);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error;
      if (typeof msg === 'object') {
        const first = Object.values(msg as Record<string, string[]>)[0];
        setError(Array.isArray(first) ? first[0] : 'Registration failed.');
      } else {
        setError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-bg-primary relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[250px] bg-red-500/15 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-12 pb-6 relative z-10">
        <button
          onClick={() => navigate('/onboarding')}
          className="text-sm text-secondary hover:text-white transition-colors"
        >
          ← Back
        </button>
        <ShieldAlert size={24} className="text-urgency-emergency" />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 relative z-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Create Account</h1>
          <p className="text-secondary text-sm">Join the rescue team. Be the hero someone needs.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider font-bold">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Carlos Sánchez"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="w-full bg-bg-secondary border border-bg-glass-border rounded-xl p-3.5 text-white placeholder-gray-600 focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 outline-none transition-all"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider font-bold">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-bg-secondary border border-bg-glass-border rounded-xl p-3.5 text-white placeholder-gray-600 focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 outline-none transition-all"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider font-bold">Password</label>
            <input
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-bg-secondary border border-bg-glass-border rounded-xl p-3.5 text-white placeholder-gray-600 focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 outline-none transition-all"
            />
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider font-bold">Confirm Password</label>
            <input
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className={`w-full bg-bg-secondary border rounded-xl p-3.5 text-white placeholder-gray-600 outline-none transition-all ${
                confirm && confirm !== password
                  ? 'border-red-500/60 focus:ring-2 focus:ring-red-500/20'
                  : 'border-bg-glass-border focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20'
              }`}
            />
            {confirm && confirm !== password && (
              <p className="text-xs text-red-400 mt-0.5">Passwords don't match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            {isLoading
              ? <Loader2 size={20} className="animate-spin" />
              : <UserPlus size={20} />
            }
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-secondary mt-8 mb-10">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-accent-cyan font-bold hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default Signup;
