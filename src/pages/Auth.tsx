import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, FileCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

/** Background image: public/background.jpg */
const BG_IMAGE = '/background.jpg';

/**
 * Full-page login with glassmorphism.
 * /auth shows this page; password reset lands here with ?reset=1.
 */
export default function Auth() {
  const navigate = useNavigate();
  const { user, loading, signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Enter your email address');
      return;
    }
    setIsLoading(true);
    const { error } = await resetPassword(email.trim());
    if (error) {
      toast.error(error.message);
    } else {
      setForgotSent(true);
      toast.success('Check your email for the reset link');
    }
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="fixed top-4 right-4 z-50 text-white [&_button]:text-white/90 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
          <ThemeToggle />
        </div>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
          style={{ backgroundImage: `url(${BG_IMAGE})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <span className="text-white/90 font-medium">Loading…</span>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Light/dark toggle - fixed top-right */}
      <div className="fixed top-4 right-4 z-50 text-white [&_button]:text-white/90 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
        <ThemeToggle />
      </div>

      {/* Background image with lower opacity */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{ backgroundImage: `url(${BG_IMAGE})` }}
        aria-hidden
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/50" aria-hidden />

      {/* Login card - glassmorphism */}
      <div
        className="relative z-10 w-[90%] max-w-[400px] rounded-2xl p-8 shadow-2xl border border-white/20"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 rounded-xl bg-white/20">
            <FileCheck className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-semibold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            SFC-G DCS
          </span>
        </div>

        {showForgot ? (
          forgotSent ? (
            <div className="space-y-6 text-center">
              <h1 className="text-xl font-semibold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                Check your email
              </h1>
              <p className="text-sm text-white/80">
                We sent a link to your email. Use it to set a new password.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowForgot(false);
                  setForgotSent(false);
                }}
                className="w-full py-3 px-4 rounded-xl text-white font-medium transition-all duration-200 hover:bg-white/20"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-5">
              <h1 className="text-xl font-semibold text-white text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
                Reset password
              </h1>
              <p className="text-sm text-white/80 text-center">
                Enter your email and we'll send you a reset link.
              </p>
              <div className="space-y-2">
                <label htmlFor="forgot-email" className="text-sm font-medium text-white/90">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder:text-white/50 border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="flex-1 py-3 px-4 rounded-xl text-white font-medium border border-white/30 hover:bg-white/10 transition-all duration-200"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 rounded-xl text-white font-medium bg-white/25 hover:bg-white/35 transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            <h1 className="text-xl font-semibold text-white text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
              Sign in
            </h1>
            <p className="text-sm text-white/80 text-center">
              Use the account created for you by the administrator.
            </p>

            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium text-white/90">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder:text-white/50 border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium text-white/90">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-white/80 hover:text-white hover:underline transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder:text-white/50 border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-white/25 hover:bg-white/35 transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Login'}
            </button>

            <p className="text-center text-sm text-white/70">
              Don't have an account?{' '}
              <Link to="/" className="text-white font-medium hover:underline">
                Contact administrator
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
