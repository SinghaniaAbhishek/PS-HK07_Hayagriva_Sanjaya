import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageLoader } from '@/components/LoadingSpinner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (!success) {
      setError('Invalid email or password');
    }
  };

  if (user) return <PageLoader />;

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 items-center justify-center bg-gradient-hero lg:flex">
        <div className="animate-slide-up px-16 text-center">
          <Eye className="mx-auto mb-6 h-16 w-16 text-primary-foreground/80" />
          <h1 className="mb-4 font-display text-4xl font-bold text-primary-foreground">Sanjaya</h1>
          <p className="text-lg text-primary-foreground/70">Seeing Beyond Sight</p>
          <div className="mt-12 space-y-4 text-left text-primary-foreground/60">
            <p className="text-sm">🔹 Admin: admin@sanjaya.com / admin123</p>
            <p className="text-sm">🔹 Guardian: guardian@sanjaya.com / guardian123</p>
          </div>
        </div>
      </div>
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Eye className="h-7 w-7 text-primary" />
            <span className="font-display text-xl font-bold">Sanjaya</span>
          </div>
          <h2 className="mb-2 font-display text-3xl font-bold text-foreground">Welcome back</h2>
          <p className="mb-8 text-muted-foreground">Sign in to access your dashboard</p>
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="you@example.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-primary py-3.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              <LogIn className="h-4 w-4" /> {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <button onClick={() => navigate('/')} className="text-primary hover:underline">← Back to home</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
