import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { apiClient } from '../api/client';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      login(data.accessToken, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-bg-primary relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[250px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

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
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Welcome Back</h1>
          <p className="text-secondary text-sm">Sign in to access your gear and requests.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider font-bold">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-bg-secondary border border-bg-glass-border rounded-xl p-3.5 text-white placeholder-gray-600 focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 outline-none transition-all"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider font-bold">Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-bg-secondary border border-bg-glass-border rounded-xl p-3.5 text-white placeholder-gray-600 focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full bg-white text-black font-bold py-4 rounded-xl flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity hover:bg-gray-100"
          >
            {isLoading
              ? <Loader2 size={20} className="animate-spin" />
              : <LogIn size={20} />
            }
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-secondary mt-8 mb-10">
          Don't have an account?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="text-urgency-emergency font-bold hover:underline"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
