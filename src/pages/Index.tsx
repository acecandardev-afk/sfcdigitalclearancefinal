import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  FileCheck,
  ArrowRight,
  Shield,
  Clock,
  CheckCircle,
  FileText,
  ListChecks,
  Mail,
  Lock,
  Loader2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

/** Background image: public/background.jpg */
const LANDING_BG = '/background.jpg';

/** Logos in public folder */
const LOGOS = ['/logo1.png', '/logo2.png', '/logo3.jpg'];

export default function Index() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading, signIn, resetPassword } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
      return;
    }
    const signin = searchParams.get('signin');
    if (signin === '1' || signin === 'true') {
      setShowSignIn(true);
      setSearchParams({}, { replace: true });
    }
  }, [user, loading, navigate, searchParams, setSearchParams]);

  const openSignIn = () => setShowSignIn(true);
  const closeSignIn = () => {
    setShowSignIn(false);
    setShowForgot(false);
    setForgotSent(false);
  };

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

  const features = [
    {
      icon: FileText,
      title: 'Digital Clearance',
      description: 'Submit and track clearance requests in one place.',
    },
    {
      icon: ListChecks,
      title: 'Assigned Signatories',
      description: 'Signatories and order are set by your administrator.',
    },
    {
      icon: Clock,
      title: 'Real-time Status',
      description: 'See approvals and updates as they happen.',
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Documents and data are stored securely.',
    },
  ];

  const steps = [
    { step: '01', title: 'Sign in', desc: 'Use the account created for you by the administrator.' },
    { step: '02', title: 'Submit', desc: 'Upload documents; signatories are assigned by the administrator.' },
    { step: '03', title: 'Track', desc: 'Monitor approvals until your clearance is complete.' },
  ];

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden font-formal">
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-50"
          style={{ backgroundImage: `url(${LANDING_BG})` }}
          aria-hidden
        />
        <div className="fixed inset-0 bg-black/45" aria-hidden />
        <div className="fixed top-4 right-4 z-50 text-white [&_button]:text-white/90 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
          <ThemeToggle />
        </div>
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
    <div className="relative min-h-screen overflow-hidden font-formal">
      {/* Full-screen background image with lower opacity */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{ backgroundImage: `url(${LANDING_BG})` }}
        aria-hidden
      />
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 bg-black/45" aria-hidden />

      <div className="fixed top-0 left-0 right-0 z-40 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      {/* Glassmorphism header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/20"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo1.png" alt="" className="h-8 w-auto object-contain" />
          <span className="font-display font-semibold text-white">E-CLEAR: SFC-Guihulngan</span>
        </div>
        <div className="flex items-center gap-3 text-white/90 [&_button]:text-white/90 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
          <Button variant="ghost" size="sm" onClick={openSignIn}>
            Sign in
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          <div className="container mx-auto px-6 py-32">
            <div className="max-w-3xl">
              {/* Institutional logos - glassmorphism badge */}
              <div
                className="inline-flex items-center justify-center gap-6 sm:gap-8 px-8 py-5 rounded-2xl mb-10 animate-fade-in"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {LOGOS.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-12 sm:h-14 w-auto max-w-[72px] object-contain opacity-90 hover:opacity-100 transition-opacity"
                  />
                ))}
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-white tracking-tight mb-6 animate-slide-up">
                Digital Clearance <span className="text-white/90">System</span>
              </h1>
              <p
                className="text-lg sm:text-xl text-white/80 max-w-xl mb-10 animate-slide-up"
                style={{ animationDelay: '0.1s' }}
              >
                Streamline academic clearance. Submit documents and track status. Signatories are assigned by your administrator.
              </p>
              <div className="flex flex-wrap items-center gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <Button
                  size="lg"
                  onClick={openSignIn}
                  className="gap-2 bg-white/25 hover:bg-white/35 text-white border-0 shadow-lg transition-all duration-200"
                >
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={openSignIn}
                  className="border-white/40 bg-transparent text-white hover:bg-white/15 hover:border-white/50 transition-all duration-200"
                >
                  Get started
                </Button>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <span className="text-xs text-white/70">Scroll</span>
            <div className="w-6 h-10 rounded-full border-2 border-white/40 flex justify-center pt-2">
              <div className="w-1.5 h-2 rounded-full bg-white/60 animate-pulse-soft" />
            </div>
          </div>
        </section>

        {/* Features - glassmorphism cards */}
        <section className="py-24 sm:py-32">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">How it works</h2>
              <p className="text-white/80">A simple, modern flow for clearance requests.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={i}
                    className="group relative p-6 rounded-2xl border border-white/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/30"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                    }}
                  >
                    <div className="p-2.5 rounded-xl bg-white/20 text-white w-fit mb-4 group-hover:bg-white/25 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-white/75">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Steps - glassmorphism */}
        <section className="py-24 sm:py-32">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">Simple steps</h2>
              <p className="text-white/80">From sign-in to completed clearance.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-4xl mx-auto">
              {steps.map((item, i) => (
                <div
                  key={i}
                  className="text-center p-8 rounded-2xl border border-white/20"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <div className="text-4xl sm:text-5xl font-display font-bold text-white/90 mb-4">{item.step}</div>
                  <h3 className="font-display font-semibold text-white text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-white/75">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA - glassmorphism */}
        <section className="py-24 sm:py-32">
          <div
            className="container mx-auto px-6 text-center max-w-2xl p-12 rounded-3xl border border-white/20"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <CheckCircle className="h-12 w-12 mx-auto mb-6 text-white/90" />
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-4">Ready to get started?</h2>
            <p className="text-white/85 mb-8">Sign in with the account provided by your administrator.</p>
            <Button
              size="lg"
              onClick={openSignIn}
              className="bg-white/25 hover:bg-white/35 text-white border-0 shadow-lg transition-all duration-200"
            >
              Sign in
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </section>

        {/* Footer - glassmorphism */}
        <footer
          className="py-8 border-t border-white/20"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div className="container mx-auto px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-white/90" />
                <span className="font-display font-semibold text-white">E-CLEAR: SFC-Guihulngan</span>
              </div>
              <p className="text-sm text-white/70">© {new Date().getFullYear()} Digital Clearance System. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>

      {/* Sign-in overlay - slides in from right, does not cover main content */}
      {showSignIn && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-end p-0 sm:p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-title"
        >
          {/* Backdrop - click to close, subtle so left content stays visible */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeSignIn}
            aria-hidden
          />
          {/* Login card - positioned on the right, does not cover main content */}
          <div
            className="relative z-10 w-full sm:w-[400px] h-full sm:h-auto sm:max-h-[90vh] sm:my-4 sm:mr-40 sm:rounded-2xl rounded-l-2xl p-8 shadow-2xl border border-white/20 animate-scale-in flex flex-col overflow-y-auto"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeSignIn}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="p-2 rounded-xl bg-white/20">
                <FileCheck className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-white font-display">E-CLEAR: SFC-Guihulngan</span>
            </div>

            {showForgot ? (
              forgotSent ? (
                <div className="space-y-6 text-center">
                  <h1 id="signin-title" className="text-xl font-semibold text-white font-display">
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
                  <h1 id="signin-title" className="text-xl font-semibold text-white text-center font-display">
                    Reset password
                  </h1>
                  <p className="text-sm text-white/80 text-center">
                    Enter your email and we will send you a reset link.
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
                        className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder:text-white/50 border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 font-formal"
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
                <h1 id="signin-title" className="text-xl font-semibold text-white text-center font-display">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder:text-white/50 border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 font-formal"
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
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 rounded-xl text-white placeholder:text-white/50 border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 font-formal"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/70 hover:text-white transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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
                  Do not have an account?{' '}
                  <span className="text-white font-medium cursor-pointer hover:underline" onClick={closeSignIn}>
                    Contact administrator
                  </span>
                </p>
              </form>
            )}

            <p className="text-center text-sm text-white/60 mt-auto pt-6 border-t border-white/20 font-display">
              Saint Francis College — Guihulngan
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
