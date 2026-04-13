import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import StudentSidebar from '@/components/layout/StudentSidebar';
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
  FileSpreadsheet,
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

interface DashboardLayoutProps {
  children: ReactNode;
}

const STUDENT_SIDEBAR_WIDTH = 288;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isSuperAdmin, isSignatory, isStudent, loading: roleLoading } = useUserRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /** Session roles (same priority as dashboard: not superadmin/signatory → student UI). */
  const sessionRoles = ((user as { roles?: string[] } | null)?.roles ?? []) as string[];
  const useStudentShell =
    !authLoading &&
    !!user &&
    sessionRoles.includes('student') &&
    !sessionRoles.includes('superadmin') &&
    !sessionRoles.includes('signatory');

  // Redirect users with no roles (e.g. removed signatory) to dashboard where they see "No access"
  useEffect(() => {
    if (!roleLoading && user && !isSuperAdmin() && !isSignatory() && !isStudent()) {
      navigate('/dashboard', { replace: true });
    }
  }, [roleLoading, user, isSuperAdmin, isSignatory, isStudent, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(isStudent()
      ? [
          { path: '/dashboard/clearances', label: 'My Clearance', icon: FileText },
          { path: '/dashboard/clearances/calendar', label: 'Clearance calendar', icon: CalendarDays },
          { path: '/dashboard/clearances/report', label: 'Clearance report', icon: FileSpreadsheet },
        ]
      : []),
    ...(isSignatory() ? [{ path: '/dashboard/requests', label: 'To Sign', icon: Bell }] : []),
    ...(isSignatory() ? [{ path: '/dashboard/approved', label: 'Signed', icon: CheckCircle }] : []),
    ...(isSuperAdmin() ? [{ path: '/dashboard/students', label: 'Students', icon: User }] : []),
    ...(isSuperAdmin() ? [{ path: '/dashboard/bulk-assign', label: 'Bulk Assign', icon: UserCheck }] : []),
    ...(isSuperAdmin() ? [{ path: '/dashboard/signatories', label: 'Signatories', icon: Users }] : []),
    ...(isSuperAdmin() ? [{ path: '/dashboard/reports', label: 'Reports', icon: BarChart3 }] : []),
    ...(isSuperAdmin() ? [{ path: '/dashboard/settings', label: 'Settings', icon: Settings }] : []),
  ];

  /* ——— Student: dedicated sidebar (reference UI) ——— */
  if (useStudentShell) {
    return (
      <div className="min-h-screen bg-background">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-[#f8fafc] px-3 md:hidden dark:border-slate-800 dark:bg-slate-950">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <img src="/logo4.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
            <span className="truncate text-sm font-semibold text-[#1e3a5f] dark:text-sky-300">E-Clear SFCG</span>
          </div>
          <NotificationBell />
        </header>

        <div className="flex min-h-[calc(100vh-3.5rem)] items-stretch gap-0 md:min-h-screen">
          <aside
            style={{ width: STUDENT_SIDEBAR_WIDTH }}
            className={cn(
              'fixed bottom-0 left-0 z-40 flex shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#f8fafc] transition-transform duration-300 ease-out dark:border-slate-800 dark:bg-slate-950 md:static md:z-0 md:h-screen md:max-h-screen md:translate-x-0',
              'top-14 md:top-0',
              sidebarOpen
                ? 'z-40 translate-x-0 shadow-2xl md:shadow-none'
                : '-translate-x-full shadow-none md:translate-x-0'
            )}
          >
            <StudentSidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>

          {sidebarOpen && (
            <div
              className="fixed inset-0 top-14 z-30 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
          )}

          <main className="relative min-h-0 min-w-0 flex-1 bg-background">
            <div className="pointer-events-none absolute right-4 top-4 z-20 hidden md:block">
              <div className="pointer-events-auto">
                <NotificationBell />
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>
    );
  }

  /* ——— Staff / admin: original layout ——— */
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
              <img src="/logo4.png" alt="" className="h-9 w-9 object-contain shrink-0" />
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
            'fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-out pt-16',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex flex-col h-full">
            <div className="flex flex-col gap-2 p-6 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <img src="/logo4.png" alt="" className="h-10 w-10 object-contain shrink-0" />
                <span className="font-semibold text-base">E-CLEAR SFCG</span>
              </div>
              <span className="text-xs text-sidebar-foreground/70">Digital Clearance System</span>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
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
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                    {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
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
                    {isSuperAdmin() ? 'Administrator' : isSignatory() ? 'Signatory' : 'Student'}
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

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <main className="flex-1 min-w-0 w-full min-h-screen bg-background text-foreground">{children}</main>
      </div>
    </div>
  );
}
