import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Loader2, GraduationCap, Building2, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { LandingPageBackground } from '@/components/LandingPageBackground';
import { cn } from '@/lib/utils';
import {
  FOOTER_MOTTO_LINE,
  INSTITUTION_LOCATION,
  INSTITUTION_NAME_UPPER,
  LANDING_LOGO_SRC,
} from '@/constants/institutionBranding';

const themeToggleClass =
  'rounded-full border border-amber-900/25 bg-amber-950/70 p-0.5 shadow-lg shadow-black/30 backdrop-blur-md [&_button]:text-amber-50 [&_button]:hover:text-white [&_button]:hover:bg-white/10';

const heroTextShadow =
  'drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)]';
const heroSubtleShadow = 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]';

/**
 * Landing: choose student vs employee (institutional) sign-in. Student and employee flows are separate user types;
 * students cannot access institutional clearance and employees use the employee flow.
 */
export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-amber-900/95">
        <LandingPageBackground />
        <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-5">
          <div className={themeToggleClass}>
            <ThemeToggle />
          </div>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-slate-950/50 shadow-lg shadow-black/40 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-amber-100" />
          </div>
          <span className={`text-sm font-medium tracking-wide text-white ${heroSubtleShadow}`}>Loading…</span>
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
          <div className="animate-hero-fade-in min-w-0 space-y-7 opacity-0 [animation-delay:0.05s] [animation-fill-mode:forwards] lg:max-w-[52%] lg:flex-1 lg:pr-4">
            <div>
              <div className="mb-5">
                <img
                  src={LANDING_LOGO_SRC}
                  alt={INSTITUTION_NAME_UPPER}
                  className="h-24 w-24 object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)] sm:h-32 sm:w-32"
                />
              </div>
              <h1
                className={`font-clearance whitespace-nowrap text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl ${heroTextShadow}`}
              >
                {INSTITUTION_NAME_UPPER}
              </h1>
              <p
                className={`mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100/95 ${heroTextShadow}`}
              >
                {INSTITUTION_LOCATION}
              </p>
            </div>
            <p
              className={`max-w-md text-pretty text-base font-medium leading-relaxed text-amber-50/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_2px_20px_rgba(0,0,0,0.4)]`}
            >
              E-Clear SFCG — two clearance programs with separate sign-ins. Use the path that matches the account
              your administrator gave you: students for student clearance, employees for institutional clearance.
            </p>
          </div>

          <div className="mx-auto w-full max-w-md shrink-0 lg:ml-auto lg:mr-0 lg:w-[min(100%,22rem)] xl:w-[min(100%,24rem)]">
            <div
              className={cn(
                'w-full space-y-5 rounded-3xl border border-amber-800/25 p-6 shadow-xl sm:p-8',
                'bg-amber-950/45 shadow-black/25 backdrop-blur-md',
                'ring-1 ring-amber-200/25',
                'animate-hero-scale-in opacity-0 [animation-delay:0.15s] [animation-fill-mode:forwards]',
              )}
            >
              <div className="text-center">
                <div
                  className="mx-auto mb-3 h-1 w-12 rounded-full bg-gradient-to-r from-amber-400 to-emerald-500"
                  aria-hidden
                />
                <h2
                  className="text-lg font-bold tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] sm:text-xl"
                >
                  How do you want to proceed?
                </h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.45)]">
                  Student clearance is only for students. Institutional clearance is only for employees and faculty
                  (not students).
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-1">
                <Button
                  type="button"
                  onClick={() => navigate('/auth/student')}
                  className={cn(
                    'group relative h-auto w-full flex-col items-stretch overflow-hidden rounded-2xl',
                    'border-2 border-slate-200 bg-white py-4 text-slate-950 shadow-md shadow-slate-900/10',
                    'transition-all duration-300 hover:scale-[1.01] hover:border-amber-500/50 hover:shadow-lg',
                    'active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-amber-500/60',
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-50/0 to-amber-50/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="relative flex w-full items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3 font-semibold">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900 ring-1 ring-amber-200/80">
                        <GraduationCap className="h-5 w-5" />
                      </span>
                      I am a student
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-amber-700/60 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-amber-900" />
                  </span>
                  <span className="relative mt-1 w-full pl-[3.25rem] text-left text-xs font-semibold text-slate-700">
                    School-issued access
                  </span>
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/auth/employee')}
                  className={cn(
                    'group relative h-auto w-full flex-col items-stretch overflow-hidden rounded-2xl',
                    'border-2 border-amber-800 bg-amber-100 py-4 text-amber-950 shadow-md',
                    'transition-all duration-300 hover:scale-[1.01] hover:border-amber-700 hover:bg-amber-50 hover:shadow-lg',
                    'active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-amber-700/60',
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-100/0 to-amber-200/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="relative flex w-full items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3 font-semibold">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-800/20 bg-amber-200/80 text-amber-950">
                        <Building2 className="h-5 w-5" />
                      </span>
                      I am an employee
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-amber-900/70 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-amber-950" />
                  </span>
                  <span className="relative mt-1 w-full pl-[3.25rem] text-left text-xs font-semibold text-amber-950/90">
                    Faculty / employee accounts
                  </span>
                </Button>
              </div>
              <p className="border-t border-white/15 pt-4 text-center text-xs font-medium leading-relaxed text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
                If your account can access both (e.g. signatory or admin), you can switch in the app after
                sign-in. Students stay on student clearance only.
              </p>
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
            className="rounded-md px-1 text-amber-100 underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            Sign in (student)
          </Link>
          <span className="text-amber-400/60" aria-hidden>
            ·
          </span>
          <Link
            to="/auth/employee"
            className="rounded-md px-1 text-amber-100 underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            Sign in (employee)
          </Link>
        </p>
      </footer>
    </div>
  );
}
