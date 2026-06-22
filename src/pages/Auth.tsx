import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { getSession } from 'next-auth/react';
import { useAuth } from '@/lib/auth';
import { friendlySignInError } from '@/lib/userMessages';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, ArrowRight, GraduationCap, Building2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Checkbox } from '@/components/ui/checkbox';
import { LandingPageBackground } from '@/components/LandingPageBackground';
import {
  FOOTER_MOTTO_LINE,
  INSTITUTION_LOCATION,
  INSTITUTION_NAME_UPPER,
  LANDING_LOGO_SRC,
} from '@/constants/institutionBranding';
import { cn } from '@/lib/utils';

const themeToggleClass =
  'rounded-full border border-amber-900/25 bg-amber-950/70 p-0.5 shadow-lg shadow-black/30 backdrop-blur-md [&_button]:text-amber-50 [&_button]:hover:text-white [&_button]:hover:bg-white/10';

const heroTitleShadow =
  'drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)]';

type NavigateFn = (to: string, opts?: { replace?: boolean }) => void;

function applyPostAuthRedirect(opts: {
  roles: string[];
  isEmployee: boolean;
  navigate: NavigateFn;
  toastOnEmployeeWrongPath: boolean;
}) {
  const { roles, isEmployee, navigate, toastOnEmployeeWrongPath } = opts;
  const isSuper = roles.includes('superadmin');
  const isSignatory = roles.includes('signatory');
  const isEmployeeRole = roles.includes('employee');
  const isFaculty = roles.includes('faculty_admin');
  const isHr = roles.includes('hr_admin');

  /** Superadmin, signatory, or employee — institutional-first flows. */
  const isInstitutionalShell = isSuper || isSignatory || isEmployeeRole;

  /**
   * Plain student accounts (no staff / admin roles). They land on the student dashboard; they open
   * My Clearance from there — do not deep-link to `/dashboard/clearances` on sign-in.
   */
  const onlyStudent =
    roles.includes('student') && !isInstitutionalShell && !isFaculty && !isHr;

  if (onlyStudent) {
    sessionStorage.setItem('clearance_type', 'student');
    if (isEmployee && toastOnEmployeeWrongPath) {
      toast.info('This page is for students. Opening your dashboard instead.');
    }
    navigate('/dashboard', { replace: true });
    return;
  }

  if (isInstitutionalShell) {
    sessionStorage.setItem('clearance_type', 'institutional');
    if (!isEmployee && toastOnEmployeeWrongPath) {
      toast.info('Redirecting you to the institutional clearance area.');
    }
    if (isSignatory || isSuper) {
      navigate('/dashboard/institutional/signatory', { replace: true });
      return;
    }
    navigate('/dashboard/institutional', { replace: true });
    return;
  }

  sessionStorage.setItem('clearance_type', isEmployee ? 'institutional' : 'student');
  navigate(isEmployee ? '/dashboard/institutional' : '/dashboard', { replace: true });
}

/**
 * /auth/student and /auth/employee — same layout; employee path targets institutional sign-in.
 */
export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEmployee = /\/auth\/employee/.test(location.pathname);
  const [searchParams] = useSearchParams();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      applyPostAuthRedirect({
        roles: ((user as { roles?: string[] }).roles ?? []) as string[],
        isEmployee,
        navigate,
        toastOnEmployeeWrongPath: false,
      });
    }
  }, [user, loading, navigate, isEmployee]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (!err) return;
    toast.error(friendlySignInError(err));
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }, [searchParams, navigate, location.pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) {
      toast.error(friendlySignInError(error.message));
    } else {
      toast.success('Welcome back!');
      const session = await getSession();
      const roles = ((session?.user as { roles?: string[] } | undefined)?.roles ?? []) as string[];
      applyPostAuthRedirect({
        roles,
        isEmployee,
        navigate,
        toastOnEmployeeWrongPath: true,
      });
    }
    setIsLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.error('Password reset is not available. Ask your administrator to reset your password.');
    setShowForgot(false);
  };

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-amber-900/95">
        <LandingPageBackground />
        <div className="fixed right-4 top-4 z-50 sm:right-5">
          <div className={themeToggleClass}>
            <ThemeToggle />
          </div>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-slate-950/50 shadow-lg shadow-black/40 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-amber-100" />
          </div>
          <span className="text-sm font-medium tracking-wide text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
            Loading…
          </span>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-amber-900/95">
      <LandingPageBackground />

      <header className="relative z-20 flex w-full items-center justify-end p-4 sm:p-5">
        <div className={themeToggleClass}>
          <ThemeToggle />
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center px-4 pb-8 pt-0 sm:px-8 sm:pb-12 lg:px-12 xl:px-16">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="min-w-0 space-y-6 text-center lg:max-w-[52%] lg:flex-1 lg:pr-4 lg:text-left">
            <div
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-sm lg:justify-start',
                isEmployee
                  ? 'border-amber-300/40 bg-amber-950/55 text-amber-50'
                  : 'border-emerald-300/40 bg-emerald-950/50 text-emerald-50',
              )}
            >
              {isEmployee ? (
                <Building2 className="h-3.5 w-3.5 opacity-90" aria-hidden />
              ) : (
                <GraduationCap className="h-3.5 w-3.5 opacity-90" aria-hidden />
              )}
              {isEmployee ? 'Institutional (employee) sign-in' : 'Student sign-in'}
            </div>
            <div>
              <div className="mb-5 flex justify-center lg:justify-start">
                <img
                  src={LANDING_LOGO_SRC}
                  alt={INSTITUTION_NAME_UPPER}
                  className="h-24 w-24 object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)] sm:h-32 sm:w-32"
                />
              </div>
              <h1
                className={cn(
                  'font-clearance whitespace-nowrap text-xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl',
                  heroTitleShadow,
                )}
              >
                {INSTITUTION_NAME_UPPER}
              </h1>
              <p className={`mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100/95 ${heroTitleShadow}`}>
                {INSTITUTION_LOCATION}
              </p>
            </div>
            <p
              className="mx-auto max-w-md text-pretty text-sm leading-relaxed text-amber-50/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] lg:mx-0"
            >
              {isEmployee
                ? 'E-Clear SFCG — sign in to manage or submit employee institutional (exit) clearance. Use the account your administrator set up for employees.'
                : 'E-Clear SFCG — sign in for student course clearance, requests, and related student services.'}
            </p>
          </div>

          <div className="mx-auto w-full max-w-md shrink-0 lg:ml-auto lg:mr-0 lg:w-[min(100%,22rem)] xl:w-[min(100%,24rem)]">
            <div
              className={cn(
                'mx-auto w-full rounded-3xl border p-6 shadow-xl sm:p-8',
                'bg-amber-950/45 backdrop-blur-md',
                'ring-1',
                isEmployee
                  ? 'border-amber-500/30 ring-amber-500/25'
                  : 'border-amber-400/25 ring-amber-400/20',
              )}
            >
              <p className="mb-5 text-center">
                <Link
                  to="/"
                  className="text-xs font-medium text-amber-200/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)] transition-colors hover:text-white hover:underline"
                >
                  ← Back to who is signing in
                </Link>
              </p>

              <div className="mb-6 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">
                  {isEmployee ? 'Institutional' : 'Student'}
                </p>
                <h2 className="text-xl font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.45)] sm:text-2xl">
                  E-CLEAR <span className="text-amber-400">SFCG</span>
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.35)]">
                  {isEmployee
                    ? 'Use your school-issued employee account. For faculty and staff institutional clearance only.'
                    : 'Use your school-issued student account. For academic clearance and student services only.'}
                </p>
              </div>

              {showForgot ? (
                <form onSubmit={handleForgot} className="space-y-5">
                  <h3 className="text-center text-lg font-bold text-white">Reset password</h3>
                  <p className="text-center text-sm text-white/90">
                    Password reset is not available yet. Ask the admin to reset your password.
                  </p>
                  <Button
                    type="button"
                    className="w-full border border-white/25 bg-white/10 font-semibold text-white hover:bg-white/15"
                    onClick={() => setShowForgot(false)}
                  >
                    Back to sign in
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="login-userid" className="text-sm font-medium text-white">
                      Email or student ID
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/70" />
                      <Input
                        id="login-userid"
                        type="text"
                        inputMode="text"
                        autoComplete="username"
                        placeholder="Email or school-issued ID"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="border-white/20 bg-white/10 pl-10 text-white shadow-inner placeholder:text-white/45 focus-visible:ring-amber-400/40"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="login-password" className="text-sm font-medium text-white">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/70" />
                      <PasswordInput
                        id="login-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border-white/20 bg-white/10 pl-10 pr-10 text-white shadow-inner placeholder:text-white/45 focus-visible:ring-amber-400/40"
                        toggleClassName="text-amber-200/80 hover:text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={rememberMe}
                        onCheckedChange={(c) => setRememberMe(!!c)}
                        className="border-white/40 data-[state=checked]:border-amber-400/60 data-[state=checked]:bg-amber-500/40"
                      />
                      <span className="text-sm text-white/90">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="shrink-0 text-xs text-amber-200/90 transition-colors hover:text-white hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className={cn(
                      'h-11 w-full font-semibold shadow-lg transition-transform active:scale-[0.99]',
                      isEmployee
                        ? 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                        : 'bg-primary text-primary-foreground hover:opacity-95',
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <p className="pt-1 text-center text-xs text-white/80">
                    Accounts are created by the administrator.
                  </p>

                  <p className="border-t border-white/15 pt-4 text-center text-sm">
                    {isEmployee ? (
                      <>
                        <span className="text-white/80">Are you a student? </span>
                        <Link
                          to="/auth/student"
                          className="font-medium text-amber-300 underline-offset-2 transition-colors hover:text-amber-200 hover:underline"
                        >
                          Student sign in
                        </Link>
                      </>
                    ) : (
                      <>
                        <span className="text-white/80">Not a student? </span>
                        <Link
                          to="/auth/employee"
                          className="font-medium text-amber-300 underline-offset-2 transition-colors hover:text-amber-200 hover:underline"
                        >
                          Employee sign in
                        </Link>
                      </>
                    )}
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-20 mt-auto w-full border-t border-amber-500/20 bg-amber-950/55 py-4 px-4 text-center shadow-[0_-4px_24px_rgba(0,0,0,0.15)] backdrop-blur-sm">
        <p className="text-sm font-semibold text-amber-50 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
          {FOOTER_MOTTO_LINE}
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-medium text-amber-100/90">
          <Link
            to="/auth/student"
            className="rounded-md px-1 text-amber-100 transition-colors hover:text-white hover:underline"
          >
            Sign in (student)
          </Link>
          <span className="text-amber-400/60" aria-hidden>
            ·
          </span>
          <Link
            to="/auth/employee"
            className="rounded-md px-1 text-amber-100 transition-colors hover:text-white hover:underline"
          >
            Sign in (employee)
          </Link>
        </p>
      </footer>
    </div>
  );
}
