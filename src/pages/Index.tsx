import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff, User, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BG_IMAGE = '/Screenshot%202026-03-04%20104258.png';

/**
 * Landing + login page: full-screen hero, two-column frame, glassmorphism card.
 * Visit / or /auth to see this design.
 */
export default function Index() {
  const navigate = useNavigate();
  const { user, loading, signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      toast.error('Please enter your email and password');
      return;
    }
    setIsLoading(true);
    const { error } = await signIn(trimmedEmail, trimmedPassword);
    if (error) {
      const msg = error.message?.toLowerCase().includes('invalid') || error.message?.toLowerCase().includes('credentials')
        ? 'Invalid email or password. Use the email your admin created for you.'
        : error.message;
      toast.error(msg);
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
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="fixed top-4 right-4 z-50 text-white [&_button]:text-white/90 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
        <ThemeToggle />
      </div>

      {/* Full-screen background hero */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BG_IMAGE})`, backgroundSize: '100% auto' }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/40" aria-hidden />

      {/* Foreground content - rectangular two-column layout */}
      <div className="relative z-10 flex-1 flex items-center justify-end w-full max-w-6xl p-4 ml-auto mr-[304px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 w-full min-h-[480px] gap-6 lg:gap-8">
          {/* Left - School branding */}
          <div className="lg:col-span-7 flex items-center">
            <div className="space-y-6">
              <div className="p-3 rounded-2xl bg-white shadow-lg border border-white/30 inline-block">
                <img src="/logo4.png" alt="" className="h-28 w-28 object-contain" />
              </div>
              <h1 className="text-4xl lg:text-[3.5rem] font-bold text-white tracking-tight drop-shadow-md leading-tight">
                SAINT FRANCIS
                <span className="block mt-2">COLLEGE</span>
              </h1>
              <p className="text-white text-base font-medium drop-shadow-sm">Guihulngan, Negros Oriental</p>
              <p className="text-white/95 text-base max-w-md leading-relaxed drop-shadow-sm">
                Digital Request Platform for Academic and Administrative Stakeholders
              </p>
            </div>
          </div>

          {/* Right - Login form (rectangular card) */}
          <div className="lg:col-span-5 flex items-center justify-center lg:justify-end">
            <div
              className="w-full max-w-md rounded-2xl border border-white/30 shadow-2xl p-7"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              {/* Card header */}
              <div className="flex flex-col items-center mb-7">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-white/40 flex items-center justify-center bg-white/30">
                      <img src="/logo4.png" alt="" className="h-9 w-9 object-contain" />
                    </div>
                    <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-white/40 flex items-center justify-center bg-white/30">
                      <img src="/logo5.png" alt="" className="h-9 w-9 object-contain" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold text-white drop-shadow-sm">
                    E-CLEAR <span className="text-amber-300">SFCG</span>
                  </h2>
                  <p className="text-base text-white mt-1.5">
                    Sign in as <span className="text-amber-300 font-semibold">Student</span>
                  </p>
                </div>

                {showForgot ? (
                  forgotSent ? (
                    <div className="space-y-5 text-center">
                      <h3 className="text-lg font-semibold text-white">Check your email</h3>
                      <p className="text-base text-white/95">
                        We sent a link to your email. Use it to set a new password.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-white/40 text-white hover:bg-white/15 h-11 text-base"
                        onClick={() => {
                          setShowForgot(false);
                          setForgotSent(false);
                        }}
                      >
                        Back to sign in
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgot} className="space-y-5">
                      <h3 className="text-lg font-semibold text-white text-center">Reset password</h3>
                      <p className="text-base text-white/95 text-center">
                        Enter your email and we will send you a reset link.
                      </p>
                      <div className="space-y-2">
                        <label htmlFor="forgot-email" className="text-sm font-medium text-white">
                          Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/80" />
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-11 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50 text-base"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-white/40 text-white hover:bg-white/15 h-11 text-base"
                          onClick={() => setShowForgot(false)}
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="flex-1 bg-white/30 hover:bg-white/40 text-white border-0 h-11 text-base"
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                        </Button>
                      </div>
                    </form>
                  )
                ) : (
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="login-email" className="text-sm font-medium text-white">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/80" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-11 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50 text-base"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="login-password" className="text-sm font-medium text-white">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/80" />
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50 text-base"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/80 hover:text-white rounded"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <Checkbox
                          checked={rememberMe}
                          onCheckedChange={(c) => setRememberMe(!!c)}
                          className="border-white/50 data-[state=checked]:bg-white/30 data-[state=checked]:border-white/50 h-4 w-4"
                        />
                        <span className="text-sm text-white">Remember me</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-sm text-white/95 hover:text-white hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label htmlFor="role-select" className="sr-only">Role</label>
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger
                            id="role-select"
                            className="bg-white/15 border-white/30 text-white h-11 justify-start gap-2 text-base [&>span]:text-white"
                          >
                            <User className="h-4 w-4 text-white/80 shrink-0" />
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900/95 border-white/20 text-base">
                            <SelectItem value="student" className="text-white focus:bg-white/15">Student</SelectItem>
                            <SelectItem value="signatory" className="text-white focus:bg-white/15">Signatory</SelectItem>
                            <SelectItem value="superadmin" className="text-white focus:bg-white/15">Superadmin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-white/35 hover:bg-white/45 text-white border-0 h-11 px-6 shrink-0 text-base font-semibold"
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                          <>
                            Sign In
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>

                    <p className="text-center text-base text-white pt-2">
                      Don&apos;t have an account?{' '}
                      <span className="text-amber-300 font-semibold">Contact administrator</span>
                    </p>
                  </form>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer strip - full width, pinned to very bottom */}
      <footer className="relative z-10 mt-auto w-full bg-amber-700/80 py-3.5 px-4 text-center">
        <p className="text-sm text-white font-medium">
          EST - 1962 - DEUS MEUS ET OMNIA | © 2026 Saint Francis College Guihulngan - Student Digital Requests
        </p>
      </footer>
    </div>
  );
}
