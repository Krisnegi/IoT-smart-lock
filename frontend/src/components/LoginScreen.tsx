import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Key, Loader2, Sparkles } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, demoLogin } = useAuth();
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'USER'>('USER');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role }),
        });

        const regData = await regRes.json();
        if (!regRes.ok) {
          throw new Error(regData.error || 'Registration failed');
        }
      }

      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await demoLogin();
    } catch (err: any) {
      setError(err.message || 'Failed to start demo credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-slate-900/40 border border-white/5 p-8 rounded-2xl backdrop-blur-xl shadow-2xl">
        
        {/* Branding header */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-extrabold font-mono tracking-tight text-slate-100">
            Smart Lock Portal
          </h2>
          <p className="mt-2 text-sm text-slate-400 font-sans">
            IoT & access authentication system
          </p>
        </div>

        {/* Demo login trigger */}
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300 font-mono">
            <Sparkles className="w-4 h-4" />
            Recruiter Demo Account
          </div>
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            Skip registration and log in with seeded admin credentials instantly to test the full-stack system.
          </p>
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 text-sm active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            One-Click Demo Admin Login
          </button>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="flex-shrink mx-4 text-xs font-mono uppercase tracking-wider text-slate-500">Or use credentials</span>
          <div className="flex-grow border-t border-white/5"></div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium px-4 py-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition"
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  Select User Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition"
                >
                  <option value="USER">USER (Access Only)</option>
                  <option value="MANAGER">MANAGER (Assign PINs & view logs)</option>
                  <option value="ADMIN">ADMIN (CRUD locks & permissions)</option>
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-white/10 text-white font-medium transition flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRegistering ? 'Register & Login' : 'Login'}
          </button>
        </form>

        {/* Register toggler */}
        <div className="text-center">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-mono tracking-wide underline underline-offset-4"
          >
            {isRegistering ? 'Already have an account? Login' : 'Need a new account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
};
