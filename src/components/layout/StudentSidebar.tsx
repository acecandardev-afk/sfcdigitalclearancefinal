import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useMeProfile } from '@/hooks/useMeProfile';
import { canRequestStudentClearance } from '@/lib/permissionsMatrix';
import { APP_LOGO_SRC, INSTITUTION_NAME } from '@/constants/institutionBranding';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  UserCircle,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

const CLEARANCE_NAV_PATHS = new Set(['/dashboard/clearances', '/dashboard/clearances/calendar']);

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/dashboard/clearances', label: 'My Clearance', icon: ClipboardList },
  { path: '/dashboard/clearances/calendar', label: 'Calendar & Analytics', icon: CalendarDays },
  { path: '/dashboard/account', label: 'Profile & Settings', icon: UserCircle },
] as const;
function initialsFromDisplay(name: string, email: string | undefined) {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  return (email ?? 'U').slice(0, 2).toUpperCase();
}

function academicSubtitle(course: string, yearLevel: string, studentId: string) {
  const left = [course, yearLevel].filter(Boolean).join(' - ');
  if (left && studentId) return `${left} · ${studentId}`;
  if (left) return left;
  if (studentId) return studentId;
  return '—';
}

function navActive(pathname: string, item: (typeof NAV)[number]) {
  switch (item.path) {
    case '/dashboard':
      return pathname === '/dashboard';
    case '/dashboard/clearances':
      if (pathname === '/dashboard/clearances') return true;
      if (pathname.startsWith('/dashboard/clearances/')) {
        const rest = pathname.slice('/dashboard/clearances/'.length);
        const seg = rest.split('/')[0] ?? '';
        if (seg === 'calendar') return false;
        return true;
      }
      return false;
    default:
      return pathname === item.path;
  }
}

interface StudentSidebarProps {
  onNavigate?: () => void;
}

export default function StudentSidebar({ onNavigate }: StudentSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useMeProfile(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = profile?.full_name?.trim() || user?.email || 'Student';
  const subtitle = profile
    ? academicSubtitle(profile.course, profile.year_level, profile.student_id)
    : '—';

  const sessionRoles = ((user as { roles?: string[] } | null)?.roles ?? []) as string[];
  const navItems = canRequestStudentClearance(sessionRoles)
    ? [...NAV]
    : NAV.filter((item) => !CLEARANCE_NAV_PATHS.has(item.path));

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand header */}
      <div className="shrink-0 bg-sidebar-primary px-4 py-5 text-sidebar-primary-foreground">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">
            <img src={APP_LOGO_SRC} alt="" className="h-full w-full object-contain p-1" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-lg font-bold leading-tight tracking-tight">E-Clear SFCG</p>
            <p className="mt-1 text-xs font-medium text-sidebar-primary-foreground/90">{INSTITUTION_NAME}</p>
            <p className="mt-0.5 text-[11px] text-sidebar-primary-foreground/75">Student Clearance System</p>
          </div>
        </div>
      </div>

      {/* Signed in */}
      <div className="shrink-0 border-b border-sidebar-border px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">Signed in as</p>
        <div className="mt-3 flex items-center gap-3">
          <Avatar className="h-11 w-11 border border-sidebar-border">
            <AvatarFallback className="bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
              {initialsFromDisplay(displayName, user?.email ?? undefined)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              {profileLoading ? '…' : displayName}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">Navigation</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = navActive(location.pathname, item);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" />
              <span className="flex-1 leading-snug">{item.label}</span>
              {active && <ChevronRight className="h-4 w-4 shrink-0 opacity-90" />}
            </Link>
          );
        })}
      </nav>

      {/* Appearance */}
      <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">Appearance</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-1">
          {(
            [
              { id: 'light' as const, label: 'Light', icon: Sun },
              { id: 'system' as const, label: 'Auto', icon: Monitor },
              { id: 'dark' as const, label: 'Dark', icon: Moon },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = mounted && theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-sidebar text-sidebar-foreground shadow-sm ring-1 ring-sidebar-border'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Help */}
      <div className="shrink-0 px-4 pb-3">
        <div className="rounded-xl bg-sidebar-accent/60 px-3 py-3">
          <p className="text-sm font-semibold text-sidebar-foreground">Need assistance?</p>
          <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/75">
            Contact the Registrar&apos;s Office for clearance-related concerns.
          </p>
        </div>
      </div>

      {/* Log out */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start gap-2 rounded-xl py-2.5 font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50"
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
        >
          <LogOut className="h-5 w-5" />
          Log Out
        </Button>
      </div>
    </div>
  );
}
