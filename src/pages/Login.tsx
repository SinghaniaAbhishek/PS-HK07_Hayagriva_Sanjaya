import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageLoader } from '@/components/LoadingSpinner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, authError, clearAuthError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [user, navigate]);

  const displayError = authError || error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearAuthError();
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (!success && !authError) {
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
            <p className="text-sm">🔹 Admin: abhisheksinghania@gmail.com</p>
            <p className="text-sm">🔹 Login not working? <Link to="/setup" className="underline">Run Admin Setup</Link></p>
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
          {displayError && (
            <div className="mb-6 flex flex-col gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{displayError}</span>
              </div>
              {authError && (
                <p className="text-xs text-destructive/80">Ensure you created the user in Firebase Console &gt; Authentication, then added the record in Realtime Database at users/&#123;your-uid&#125; with role: &quot;admin&quot;</p>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); clearAuthError(); setError(''); }} required
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="you@example.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); clearAuthError(); setError(''); }} required
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
