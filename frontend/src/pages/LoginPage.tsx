import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/teams', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-court-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-spike-500 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-court-950">
              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4zm-1 3v3H6l4 4 4-4h-3V7H9z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-chalk-100 tracking-tight">VolleyVision</span>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-chalk-100 mb-1">Welcome back</h1>
          <p className="text-chalk-500 text-sm mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-900/30 border border-red-700 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-chalk-400 text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-chalk-400 text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-chalk-500 text-sm mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-spike-400 hover:text-spike-300 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
