import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { useClearanceType } from '@/lib/clearanceTypeContext';
import { useSwitchClearanceType } from '@/components/auth/StaffModuleResolver';
import {
  canManageBulkAssign,
  canManageStudents,
  canManageSystemSettings,
  canManageArchivedRecords,
  canCreateOwnInstitutionalClearanceRequest,
  canRequestStudentClearance,
  canViewAdminReports,
  canWriteSignatories,
  showStudentSignatoryQueueInMainNav,
} from '@/lib/permissionsMatrix';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import StudentSidebar from '@/components/layout/StudentSidebar';
import InstitutionalSidebar from '@/components/layout/InstitutionalSidebar';
import { InstitutionalContentFooter } from '@/components/layout/InstitutionalContentFooter';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
  Bell,
  CheckCircle,
  UserCheck,
  BarChart3,
  CalendarDays,
  Building2,
  ClipboardList,
  Archive,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useSignatoryPendingCounts } from '@/hooks/useSignatoryPendingCounts';
import { APP_LOGO_SRC } from '@/constants/institutionBranding';
import { usePreClearanceNavAccess } from '@/hooks/usePreClearanceNavAccess';

interface DashboardLayoutProps {
  children: ReactNode;
}

const STUDENT_SIDEBAR_WIDTH = 288;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isSuperAdmin, isSignatory, isStudent, isEmployee, isFacultyAdmin, isHrAdmin, loading: roleLoading } =
    useUserRole();
  const { clearanceModule } = useClearanceType();
  const switchClearanceType = useSwitchClearanceType();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  /** Session roles (same priority as dashboard: not superadmin/signatory → student UI). */
  const sessionRoles = ((user as { roles?: string[] } | null)?.roles ?? []) as string[];
  const signatoryStudentNavCounts = useSignatoryPendingCounts({
    fetchStudent: sessionRoles.includes('signatory') && clearanceModule === 'student',
    fetchInstitutional: false,
  });
  const showPreClearanceNav = usePreClearanceNavAccess(
    clearanceModule === 'student' && !!user && !authLoading
  );
  /** Student-only UI when in “student” platform mode. */
  const useStudentShell =
    !authLoading &&
    !!user &&
    sessionRoles.includes('student') &&
    !sessionRoles.includes('superadmin') &&
    !sessionRoles.includes('signatory') &&
    !sessionRoles.includes('faculty_admin') &&
    !sessionRoles.includes('hr_admin') &&
    clearanceModule === 'student';

  /** Institutional: same full-height sidebar + main + footer as student (reference) */
  const useInstitutionalShell =
    !authLoading && !!user && clearanceModule === 'institutional';

  // Redirect users with no roles (e.g. removed signatory) to dashboard where they see "No access"
  useEffect(() => {
    if (!roleLoading && user && !isSuperAdmin() && !isSignatory() && !isEmployee() && !isStudent() && !isFacultyAdmin() && !isHrAdmin()) {
      navigate('/dashboard', { replace: true });
    }
  }, [roleLoading, user, isSuperAdmin, isSignatory, isEmployee, isStudent, isFacultyAdmin, isHrAdmin, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  const studentNav = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(canRequestStudentClearance(sessionRoles)
      ? [
          { path: '/dashboard/clearances', label: 'My Clearance', icon: FileText },
          { path: '/dashboard/clearances/calendar', label: 'Clearance calendar', icon: CalendarDays },
        ]
      : []),
    ...(showStudentSignatoryQueueInMainNav(sessionRoles)
      ? [
          { path: '/dashboard/requests', label: 'To Sign', icon: Bell },
          { path: '/dashboard/approved', label: 'Signed', icon: CheckCircle },
        ]
      : []),
    ...(showPreClearanceNav
      ? [{ path: '/dashboard/pre-clearance', label: 'Physical verification', icon: UserCheck }]
      : []),
    ...(canManageStudents(sessionRoles) ? [{ path: '/dashboard/students', label: 'Students', icon: User }] : []),
    ...(canManageBulkAssign(sessionRoles) ? [{ path: '/dashboard/bulk-assign', label: 'Bulk Assign', icon: UserCheck }] : []),
    ...(canWriteSignatories(sessionRoles) ? [{ path: '/dashboard/signatories', label: 'Signatories', icon: Users }] : []),
    ...(canViewAdminReports(sessionRoles) ? [{ path: '/dashboard/reports', label: 'Reports', icon: BarChart3 }] : []),
    ...(canManageSystemSettings(sessionRoles) ? [{ path: '/dashboard/settings', label: 'Settings', icon: Settings }] : []),
    ...(canManageArchivedRecords(sessionRoles) ? [{ path: '/dashboard/archived', label: 'Archived', icon: Archive }] : []),
  ];

  const institutionalNav = [
    { path: '/dashboard/institutional', label: 'Institutional', icon: Building2 },
    { path: '/dashboard/institutional/clearances', label: 'All clearances', icon: ClipboardList },
    ...(canCreateOwnInstitutionalClearanceRequest(sessionRoles)
      ? [{ path: '/dashboard/institutional/clearances/new', label: 'New clearance', icon: FileText }]
      : []),
  ];

  const navItems = clearanceModule === 'institutional' ? institutionalNav : studentNav;

  /* ——— Student: dedicated sidebar (reference UI) ——— */
  if (useStudentShell) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background">
        <header className="z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-[#f8fafc] px-3 dark:border-slate-800 dark:bg-slate-950">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 touch-manipulation"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start">
            <img src={APP_LOGO_SRC} alt="" className="h-8 w-8 shrink-0 object-contain" />
            <span className="truncate text-sm font-semibold text-[#1e3a5f] dark:text-sky-300">E-Clear SFCG</span>
          </div>
          <NotificationBell />
        </header>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              'fixed inset-0 top-14 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out',
              sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            )}
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
            aria-hidden={!sidebarOpen}
          />

          <aside
            style={{ width: STUDENT_SIDEBAR_WIDTH }}
            className={cn(
              'fixed bottom-0 left-0 top-14 z-40 flex shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#f8fafc] shadow-2xl transition-transform duration-300 ease-in-out will-change-transform dark:border-slate-800 dark:bg-slate-950',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
            aria-hidden={!sidebarOpen}
          >
            <StudentSidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>

          <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background [scrollbar-gutter:stable]">
            {children}
          </main>
        </div>
      </div>
    );
  }

  if (useInstitutionalShell) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background">
        <header className="z-50 grid h-14 shrink-0 grid-cols-[auto,minmax(0,1fr),auto] items-center gap-2 border-b border-slate-200 bg-[#f8fafc] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] dark:border-slate-800 dark:bg-slate-950">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 touch-manipulation"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex min-w-0 items-center justify-center gap-2 sm:justify-start">
            <img src={APP_LOGO_SRC} alt="" className="h-8 w-8 shrink-0 object-contain" />
            <span className="min-w-0 truncate text-sm font-semibold text-[#1e3a5f] dark:text-sky-300">
              E-Clear SFCG — Institutional
            </span>
          </div>
          <div className="shrink-0">
            <NotificationBell />
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              'fixed inset-0 top-14 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out',
              sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            )}
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
            aria-hidden={!sidebarOpen}
          />

          <aside
            className={cn(
              'fixed bottom-0 left-0 top-14 z-40 flex min-h-0 w-[min(18rem,calc(100vw-0.5rem))] min-w-0 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#f8fafc] shadow-2xl transition-transform duration-300 ease-in-out will-change-transform sm:w-72 dark:border-slate-800 dark:bg-slate-950',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
            aria-hidden={!sidebarOpen}
          >
            <InstitutionalSidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background [scrollbar-gutter:stable]">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-[env(safe-area-inset-bottom)]">
              {children}
            </div>
            <InstitutionalContentFooter />
          </main>
        </div>
      </div>
    );
  }

  /* ——— Employee / admin: original layout (student platform, mixed roles) ——— */
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
              <img src={APP_LOGO_SRC} alt="" className="h-9 w-9 object-contain shrink-0" />
              <span className="font-semibold text-base truncate">E-CLEAR SFCG</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user?.email ? getInitials(user.email) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/dashboard/account')}>
                  <User className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    switchClearanceType();
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Switch platform
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-in-out will-change-transform pt-16 shadow-2xl',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          aria-hidden={!sidebarOpen}
        >
          <div className="flex flex-col h-full">
            <div className="flex flex-col gap-2 p-6 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <img src={APP_LOGO_SRC} alt="" className="h-10 w-10 object-contain shrink-0" />
                <span className="font-semibold text-base">E-CLEAR SFCG</span>
              </div>
              <span className="text-xs text-sidebar-foreground/70">Digital Clearance System</span>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isRequestsItem = item.path === '/dashboard/requests';
                const isActive = isRequestsItem
                  ? location.pathname === '/dashboard/requests' ||
                    location.pathname.startsWith('/dashboard/requests/')
                  : location.pathname === item.path;
                const pendingBadge =
                  isRequestsItem &&
                  signatoryStudentNavCounts.studentPending != null &&
                  signatoryStudentNavCounts.studentPending > 0
                    ? signatoryStudentNavCounts.studentPending
                    : null;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                        : 'hover:bg-sidebar-accent text-sidebar-foreground/90 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 font-medium truncate">{item.label}</span>
                    {pendingBadge != null ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold tabular-nums text-destructive-foreground">
                        {pendingBadge > 99 ? '99+' : pendingBadge}
                      </span>
                    ) : null}
                    {isActive && <ChevronRight className="h-4 w-4 shrink-0" />}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                    {user?.email ? getInitials(user.email) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-sidebar-foreground/60">
                    {isSuperAdmin()
                      ? 'Administrator'
                      : isFacultyAdmin()
                        ? 'Faculty admin'
                        : isHrAdmin()
                          ? 'HR admin'
                          : isSignatory()
                            ? 'Signatory'
                            : isEmployee()
                              ? 'Employee'
                              : 'Student'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start mt-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-3" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        <div
          className={cn(
            'fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm transition-opacity duration-300 ease-in-out',
            sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={() => setSidebarOpen(false)}
          aria-hidden={!sidebarOpen}
        />

        <main className="flex-1 min-w-0 w-full min-h-screen bg-background text-foreground">{children}</main>
      </div>
    </div>
  );
}
