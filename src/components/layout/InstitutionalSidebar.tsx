import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useEffect, useState, type ComponentType } from 'react';
import { useAuth } from '@/lib/auth';
import { useMeProfile } from '@/hooks/useMeProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useSignatoryPendingCounts } from '@/hooks/useSignatoryPendingCounts';
import {
  canCreateOwnInstitutionalClearanceRequest,
  canManageStudents,
  canWriteSignatories,
  showInstitutionalSignatoryQueueInNav,
} from '@/lib/permissionsMatrix';
import { APP_LOGO_SRC, INSTITUTION_NAME } from '@/constants/institutionBranding';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  FileCog,
  UserCircle,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Bell,
  CheckCircle2,
  Shield,
  ListTree,
  Users,
  GraduationCap,
} from 'lucide-react';

type NavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
  badgeCount?: number;
};

function initialsFromName(name: string, email: string | undefined) {
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

function clearanceListMatch(p: string, options: { excludeNew: boolean }) {
  if (p === '/dashboard/institutional/clearances') return true;
  if (p.startsWith('/dashboard/institutional/clearances/')) {
    if (options.excludeNew && p.includes('/new')) return false;
    if (p.includes('/print')) return false;
    if (p.includes('/pending') || p.includes('/signed') || p.includes('/admin')) return false;
    return true;
  }
  return false;
}

function buildNav(params: {
  roles: string[];
  isSuperAdmin: boolean;
  isHrAdmin: boolean;
  studentClearancePending: number | null;
  institutionalExitToSign: number | null;
}): NavItem[] {
  const { roles, isSuperAdmin, isHrAdmin, studentClearancePending, institutionalExitToSign } = params;
  const list: NavItem[] = [];
  const canRequester = canCreateOwnInstitutionalClearanceRequest(roles);

  const employeeRequesterItems: NavItem[] = [
    {
      path: '/dashboard/institutional',
      label: 'Dashboard',
      icon: LayoutDashboard,
      match: (p) => p === '/dashboard/institutional',
    },
    {
      path: '/dashboard/institutional/clearances',
      label: 'My Clearance',
      icon: ClipboardList,
      match: (p) => clearanceListMatch(p, { excludeNew: true }),
    },
    {
      path: '/dashboard/institutional/clearances/calendar',
      label: 'Calendar & Analytics',
      icon: CalendarDays,
      match: (p) => p === '/dashboard/institutional/clearances/calendar',
    },
    {
      path: '/dashboard/institutional/clearances/report',
      label: 'General Report',
      icon: FileCog,
      match: (p) => p === '/dashboard/institutional/clearances/report',
    },
  ];

  const adminInstitutionalOverviewItems: NavItem[] = [
    {
      path: '/dashboard/institutional',
      label: 'Overview',
      icon: LayoutDashboard,
      match: (p) => p === '/dashboard/institutional',
    },
    {
      path: '/dashboard/institutional/clearances',
      label: 'All clearances',
      icon: ClipboardList,
      match: (p) => clearanceListMatch(p, { excludeNew: true }),
    },
    {
      path: '/dashboard/institutional/clearances/calendar',
      label: 'Calendar & Analytics',
      icon: CalendarDays,
      match: (p) => p === '/dashboard/institutional/clearances/calendar',
    },
    {
      path: '/dashboard/institutional/clearances/report',
      label: 'General Report',
      icon: FileCog,
      match: (p) => p === '/dashboard/institutional/clearances/report',
    },
  ];

  if (canRequester) {
    list.push(...employeeRequesterItems);
  } else if (isSuperAdmin || isHrAdmin) {
    list.push(...adminInstitutionalOverviewItems);
  }

  const showSignatoryQueueNav = showInstitutionalSignatoryQueueInNav(roles);

  if (showSignatoryQueueNav) {
    list.push({
      path: '/dashboard/institutional/signatory',
      label: 'Signatory dashboard',
      icon: LayoutDashboard,
      match: (p) => p === '/dashboard/institutional/signatory',
    });
    list.push({
      path: '/dashboard/requests',
      label: 'Student clearance — To sign',
      icon: GraduationCap,
      match: (p) => p === '/dashboard/requests' || p.startsWith('/dashboard/requests/'),
      badgeCount:
        studentClearancePending != null && studentClearancePending > 0
          ? studentClearancePending
          : undefined,
    });
    list.push(
      {
        path: '/dashboard/institutional/pending',
        label: 'Exit clearance — Pending',
        icon: Bell,
        match: (p) => p.startsWith('/dashboard/institutional/pending'),
        badgeCount:
          institutionalExitToSign != null && institutionalExitToSign > 0
            ? institutionalExitToSign
            : undefined,
      },
      {
        path: '/dashboard/institutional/signed',
        label: 'Exit clearance — History',
        icon: CheckCircle2,
        match: (p) => p.startsWith('/dashboard/institutional/signed'),
      }
    );
  }
  if (isSuperAdmin || isHrAdmin) {
    list.push({
      path: '/dashboard/institutional/admin',
      label: 'Admin overview',
      icon: Shield,
      match: (p) => p.startsWith('/dashboard/institutional/admin'),
    });
  }
  if (isSuperAdmin || isHrAdmin) {
    list.push({
      path: '/dashboard/institutional/settings/offices',
      label: 'Institutional offices',
      icon: ListTree,
      match: (p) => p.startsWith('/dashboard/institutional/settings'),
    });
  }
  if (canWriteSignatories(roles)) {
    list.push({
      path: '/dashboard/signatories',
      label: 'Signatories',
      icon: Users,
      match: (p) => p === '/dashboard/signatories',
    });
  }
  if (canManageStudents(roles)) {
    list.push({
      path: '/dashboard/students',
      label: 'Students',
      icon: GraduationCap,
      match: (p) => p === '/dashboard/students' || p.startsWith('/dashboard/students/'),
    });
  }
  list.push({
    path: '/dashboard/account',
    label: 'Profile & Settings',
    icon: UserCircle,
    match: (p) => p === '/dashboard/account' || p.startsWith('/dashboard/account/'),
  });
  return list;
}

interface InstitutionalSidebarProps {
  onNavigate?: () => void;
}

export default function InstitutionalSidebar({ onNavigate }: InstitutionalSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isSuperAdmin, isHrAdmin, roles } = useUserRole();
  const institutionalPersonaSignatory = showInstitutionalSignatoryQueueInNav(roles);
  const { profile, loading: profileLoading } = useMeProfile(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const pendingCounts = useSignatoryPendingCounts({
    fetchStudent: institutionalPersonaSignatory,
    fetchInstitutional: institutionalPersonaSignatory,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = profile?.full_name?.trim() || user?.email || 'User';
  const subtitle = profile
    ? [profile.course, profile.year_level].filter(Boolean).join(' · ') || '—'
    : '—';

  const nav = buildNav({
    roles,
    isSuperAdmin: isSuperAdmin(),
    isHrAdmin: isHrAdmin(),
    studentClearancePending: pendingCounts.studentPending,
    institutionalExitToSign: pendingCounts.institutionalToSign,
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="shrink-0 bg-sidebar-primary px-4 py-5 text-sidebar-primary-foreground">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">
            <img src={APP_LOGO_SRC} alt="" className="h-full w-full object-contain p-1" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-lg font-bold leading-tight tracking-tight">E-Clear SFCG</p>
            <p className="mt-1 text-xs font-medium text-sidebar-primary-foreground/90">{INSTITUTION_NAME}</p>
            <p className="mt-0.5 text-[11px] text-sidebar-primary-foreground/75">
              {institutionalPersonaSignatory ? 'Signatory Clearance System' : 'Employee Clearance System'}
            </p>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-sidebar-border px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">Signed in as</p>
        <div className="mt-3 flex items-center gap-3">
          <Avatar className="h-11 w-11 border border-sidebar-border">
            <AvatarFallback className="bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
              {initialsFromName(displayName, user?.email ?? undefined)}
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

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">Navigation</p>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.match(location.pathname);
          return (
            <Link
              key={item.path + item.label}
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
              {item.badgeCount != null && item.badgeCount > 0 ? (
                <span
                  className="ml-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold tabular-nums text-destructive-foreground"
                  aria-label={`${item.badgeCount} pending`}
                >
                  {item.badgeCount > 99 ? '99+' : item.badgeCount}
                </span>
              ) : null}
              {active && <ChevronRight className="h-4 w-4 shrink-0 opacity-90" />}
            </Link>
          );
        })}
      </nav>

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

      <div className="shrink-0 px-4 pb-3">
        <div className="rounded-xl bg-sidebar-accent/60 px-3 py-3">
          <p className="text-sm font-semibold text-sidebar-foreground">Need assistance?</p>
          <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/75">
            Contact the Registrar&apos;s Office for clearance-related concerns.
          </p>
        </div>
      </div>

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
          Log out
        </Button>
      </div>
    </div>
  );
}
