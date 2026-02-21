/**
 * One-time Admin Setup Page
 * Use this if admin login fails - creates the database record for your Firebase Auth user.
 * Go to /setup and enter your credentials. If you exist in Firebase Auth, it will add the DB record.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, CheckCircle, AlertCircle } from 'lucide-react';

const AdminSetup = () => {
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState('abhisheksinghania@gmail.com');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        setStatus('success');
        setMessage('Admin record already exists! Redirecting...');
        await refreshUser();
        navigate('/admin');
      } else {
        await set(userRef, {
          email: email.toLowerCase(),
          name: 'System Admin',
          role: 'admin',
          phone: '',
          linkedDevices: {},
        });
        setStatus('success');
        setMessage('Admin record created! Redirecting...');
        await refreshUser();
        navigate('/admin');
      }
    } catch (error: any) {
      setStatus('error');
      if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/user-not-found') {
        setMessage('User not found in Firebase Authentication. First create the user: Firebase Console > Authentication > Add user');
      } else if (error?.code === 'auth/wrong-password') {
        setMessage('Incorrect password.');
      } else {
        setMessage(error?.message || 'Setup failed');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <Eye className="h-8 w-8 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Admin Setup</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          If admin login fails, use this page to create your database record. Your user must already exist in Firebase Console &gt; Authentication.
        </p>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Enter your Firebase Auth password"
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
            />
          </div>

          {message && (
            <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
              {status === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-gradient-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {status === 'loading' ? 'Setting up...' : 'Create Admin Record'}
          </button>
        </form>

        <button onClick={() => navigate('/login')} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground">
          ← Back to Login
        </button>
      </div>
    </div>
  );
};

export default AdminSetup;
