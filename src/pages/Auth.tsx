import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { friendlySignInError } from '@/lib/userMessages';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff, User, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const BG_IMAGE = '/Screenshot%202026-03-04%20104258.png';

/**
 * Full-page login with two-column layout and glassmorphism card.
 * /auth shows this page; password reset lands here.
 */
export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (!err) return;
    toast.error(friendlySignInError(err));
    navigate({ pathname: '/auth', search: '' }, { replace: true });
  }, [searchParams, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
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
    toast.error('Password reset is not available yet. Ask the admin to reset your password.');
    setShowForgot(false);
  };

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="fixed top-4 right-4 z-50 text-white [&_button]:text-white/90 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
          <ThemeToggle />
        </div>
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${BG_IMAGE})` }} aria-hidden />
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
      <div className="fixed top-4 right-4 z-50 text-white [&_button]:text-white/90 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
        <ThemeToggle />
      </div>

      {/* Full-screen background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BG_IMAGE})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/50" aria-hidden />

      {/* Foreground content - centered */}
      <div className="relative z-10 flex items-center justify-center w-full max-w-6xl">
        {/* Main frame container */}
        <div className="w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl flex flex-col bg-black/10 backdrop-blur-sm">
          {/* Content area - flex-1 */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
            {/* Left branding section */}
            <div className="lg:col-span-7 flex items-center px-8 py-10 lg:py-14">
              <div className="space-y-6">
                <div className="flex-shrink-0">
                  <img src="/logo4.png" alt="" className="h-20 w-20 object-contain" />
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                  SAINT FRANCIS COLLEGE
                </h1>
                <p className="text-white/90 text-sm font-medium">Guihulngan, Negros Oriental</p>
                <p className="text-white/70 text-sm max-w-md leading-relaxed">
                  Digital Clearance Platform for Academic and Administrative Stakeholders
                </p>
              </div>
            </div>

            {/* Right login section */}
            <div className="lg:col-span-5 flex items-center justify-center px-6 py-10">
              {/* Glassmorphism card - translucent, blurred background visible through */}
              <div
                className="w-full max-w-sm rounded-2xl border border-white/20 shadow-xl p-6"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              >
                {/* Card header - two logos, title, subtitle */}
                <div className="flex flex-col items-center mb-6">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-white/30 flex items-center justify-center bg-white/20">
                      <img src="/logo4.png" alt="" className="h-8 w-8 object-contain" />
                    </div>
                    <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-white/30 flex items-center justify-center bg-white/20">
                      <img src="/logo5.png" alt="" className="h-8 w-8 object-contain" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold text-white">
                    E-CLEAR <span className="text-amber-400">SFCG</span>
                  </h2>
                  <p className="text-sm text-white/80 mt-1">
                    Sign in as <span className="text-amber-400 font-medium">Student</span>
                  </p>
                </div>

                {showForgot ? (
                  <form onSubmit={handleForgot} className="space-y-5">
                    <h3 className="text-lg font-semibold text-white text-center">Reset password</h3>
                    <p className="text-sm text-white/80 text-center">
                      Password reset is not available yet.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-white/30 text-white hover:bg-white/10"
                      onClick={() => setShowForgot(false)}
                    >
                      Back to sign in
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="login-userid" className="text-sm font-medium text-white/90">
                        User Id
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                        <Input
                          id="login-userid"
                          type="email"
                          placeholder="Enter your ID number"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/40"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="login-password" className="text-sm font-medium text-white/90">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/40"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/70 hover:text-white"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember me + Forgot password row */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={rememberMe}
                          onCheckedChange={(c) => setRememberMe(!!c)}
                          className="border-white/40 data-[state=checked]:bg-white/20 data-[state=checked]:border-white/40"
                        />
                        <span className="text-sm text-white/80">Remember me</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs text-white/80 hover:text-white hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-sm text-white/70 pt-1">
                      Accounts are created by the administrator.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <footer className="bg-amber-700/80 py-3 px-4 text-center shrink-0">
            <p className="text-xs text-white/90">
              EST - 1962 - DEUS MEUS ET OMNIA | © 2026 Saint Francis College Guihulngan - Student Digital Clearance
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
