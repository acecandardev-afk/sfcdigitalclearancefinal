import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Mail,
  Database,
  Loader2,
  Save,
  Building2,
  Users,
  UserCog,
  Search,
  Activity,
  LogIn,
  LogOut,
  FileText,
  Edit,
  Trash,
  Eye,
  Upload,
  UserPlus,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { logActivity } from '@/hooks/useActivityLog';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
}

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const { roles, loading: roleLoading } = useUserRole();
  const isSuperAdminUser = roles.includes('superadmin');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // System settings state
  const [systemName, setSystemName] = useState('SFC-G DCS');
  const [institutionName, setInstitutionName] = useState('St. Francis College - Guihulngan');
  const [adminEmail, setAdminEmail] = useState('admin@sfc-g.edu.ph');
  
  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(true);
  const [notifyOnApproval, setNotifyOnApproval] = useState(true);
  const [notifyOnRejection, setNotifyOnRejection] = useState(true);

  // Security settings
  const [requireAllSignatures, setRequireAllSignatures] = useState(true);
  const [allowMultipleClearances, setAllowMultipleClearances] = useState(false);
  const [autoApproveAfterDays, setAutoApproveAfterDays] = useState('');

  /** YYYY-MM-DD for <input type="date" />; empty means not set */
  const [clearancePeriodStart, setClearancePeriodStart] = useState('');
  const [clearancePeriodEnd, setClearancePeriodEnd] = useState('');

  // User management state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        roles: (userRoles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole),
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleEditRoles = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles);
    setRoleDialogOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    setSavingRoles(true);
    try {
      // Delete existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.id);

      if (deleteError) throw deleteError;

      // Insert new roles
      if (selectedRoles.length > 0) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(
            selectedRoles.map((role) => ({
              user_id: selectedUser.id,
              role,
            }))
          );

        if (insertError) throw insertError;
      }

      // Log the activity
      await logActivity({
        action: 'update_user_roles',
        details: {
          target_user_id: selectedUser.id,
          target_user_email: selectedUser.email,
          new_roles: selectedRoles,
        },
      });

      toast.success('User roles updated successfully');
      setRoleDialogOpen(false);
      fetchUsers();
      fetchActivityLogs();
    } catch (error) {
      console.error('Error updating roles:', error);
      toast.error('Failed to update roles');
    } finally {
      setSavingRoles(false);
    }
  };

  const toggleRole = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchActivityLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data: logs, error: logsError } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsError) throw logsError;

      // Get user info for each log
      const userIds = [...new Set((logs || []).map((log) => log.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const profilesAny = (profiles || []) as any[];
      const profileMap = new Map<string, any>(profilesAny.map((p) => [String(p.id), p]) || []);

      const logsAny = (logs || []) as any[];
      const logsWithUsers: ActivityLog[] = logsAny.map((log) => ({
        ...log,
        details: log.details as Record<string, unknown> | null,
        user_email: (profileMap.get(String(log.user_id)) as any)?.email || 'Unknown',
        user_name: (profileMap.get(String(log.user_id)) as any)?.full_name || 'Unknown User',
      }));

      setActivityLogs(logsWithUsers);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <LogIn className="h-4 w-4 text-green-500" />;
      case 'logout':
        return <LogOut className="h-4 w-4 text-muted-foreground" />;
      case 'signup':
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'create_clearance':
        return <FileText className="h-4 w-4 text-primary" />;
      case 'sign_clearance':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'reject_clearance':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'upload_file':
        return <Upload className="h-4 w-4 text-blue-500" />;
      case 'view_clearance':
      case 'view_dashboard':
        return <Eye className="h-4 w-4 text-muted-foreground" />;
      case 'update_user_roles':
      case 'update_signatory':
      case 'update_clearance':
        return <Edit className="h-4 w-4 text-orange-500" />;
      case 'delete_signatory':
        return <Trash className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatActionLabel = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const filteredLogs = activityLogs.filter((log) => {
    const matchesSearch =
      log.user_name?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(logSearchQuery.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(activityLogs.map((log) => log.action))];

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const sb: typeof supabase & { from: (table: string) => any } = supabase as any;
      const keys = ['general', 'notifications', 'security', 'clearance'];
      for (const key of keys) {
        const { data, error } = await sb
          .from('system_settings')
          .select('value_json')
          .eq('key', key)
          .maybeSingle();
        if (error) throw error;
        const v = data?.value_json as Record<string, unknown> | null;
        if (key === 'general' && v) {
          setSystemName((v.system_name as string) ?? 'SFC-G DCS');
          setInstitutionName((v.institution_name as string) ?? 'Saint Francis College - Guihulngan');
          setAdminEmail((v.admin_email as string) ?? 'admin@sfc-g.edu.ph');
        }
        if (key === 'notifications' && v) {
          setEmailNotifications((v.email_notifications as boolean) ?? true);
          setNotifyOnSubmission((v.notify_on_submission as boolean) ?? true);
          setNotifyOnApproval((v.notify_on_approval as boolean) ?? true);
          setNotifyOnRejection((v.notify_on_rejection as boolean) ?? true);
        }
        if (key === 'security' && v) {
          setRequireAllSignatures((v.require_all_signatures as boolean) ?? true);
          setAllowMultipleClearances((v.allow_multiple_clearances as boolean) ?? false);
          setAutoApproveAfterDays(v.auto_approve_after_days != null ? String(v.auto_approve_after_days) : '');
        }
        if (key === 'clearance' && v) {
          const ps = v.period_start;
          const pe = v.period_end;
          setClearancePeriodStart(typeof ps === 'string' ? ps.slice(0, 10) : '');
          setClearancePeriodEnd(typeof pe === 'string' ? pe.slice(0, 10) : '');
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
      toast.error('Failed to load settings');
    }
  };

  useEffect(() => {
    if (!roleLoading && !isSuperAdminUser) {
      navigate('/dashboard');
    } else if (!roleLoading && isSuperAdminUser) {
      fetchUsers();
      fetchActivityLogs();
      fetchSettings();
    }
  }, [roleLoading, isSuperAdminUser, navigate]);

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      const sb: typeof supabase & { from: (table: string) => any } = supabase as any;
      const { error } = await sb
        .from('system_settings')
        .upsert(
          {
            key: 'general',
            value_json: {
              system_name: systemName,
              institution_name: institutionName,
              admin_email: adminEmail,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
      if (error) throw error;
      toast.success('General settings saved successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      const sb: typeof supabase & { from: (table: string) => any } = supabase as any;
      const { error } = await sb
        .from('system_settings')
        .upsert(
          {
            key: 'notifications',
            value_json: {
              email_notifications: emailNotifications,
              notify_on_submission: notifyOnSubmission,
              notify_on_approval: notifyOnApproval,
              notify_on_rejection: notifyOnRejection,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
      if (error) throw error;
      toast.success('Notification settings saved successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    setSaving(true);
    try {
      const sb: typeof supabase & { from: (table: string) => any } = supabase as any;
      const { error } = await sb
        .from('system_settings')
        .upsert(
          {
            key: 'security',
            value_json: {
              require_all_signatures: requireAllSignatures,
              allow_multiple_clearances: allowMultipleClearances,
              auto_approve_after_days: autoApproveAfterDays ? parseInt(autoApproveAfterDays, 10) : null,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
      if (error) throw error;
      toast.success('Security settings saved successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClearancePeriod = async () => {
    const hasStart = clearancePeriodStart.trim().length > 0;
    const hasEnd = clearancePeriodEnd.trim().length > 0;
    if (hasStart !== hasEnd) {
      toast.error('Set both start and end dates, or clear both to leave the period unset.');
      return;
    }
    if (hasStart && hasEnd && clearancePeriodStart > clearancePeriodEnd) {
      toast.error('End date must be on or after the start date.');
      return;
    }
    setSaving(true);
    try {
      const sb: typeof supabase & { from: (table: string) => any } = supabase as any;
      const { error } = await sb
        .from('system_settings')
        .upsert(
          {
            key: 'clearance',
            value_json: {
              period_start: hasStart ? clearancePeriodStart : null,
              period_end: hasEnd ? clearancePeriodEnd : null,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
      if (error) throw error;
      toast.success('Clearance period saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save clearance period');
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isSuperAdminUser) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure system-wide settings and preferences
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid rounded-xl p-1 bg-muted/50">
            <TabsTrigger value="general" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card className="border border-border/50 rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">General Settings</CardTitle>
                <CardDescription>
                  Basic system configuration and institution details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="systemName">System Name</Label>
                  <Input
                    id="systemName"
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    placeholder="Digital Clearance System"
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    This name appears in the header and emails
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="institutionName">Institution Name</Label>
                  <Input
                    id="institutionName"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="Your School or University"
                    className="rounded-xl"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Admin Contact Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.edu"
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    This email receives system notifications and error reports
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveGeneral} disabled={saving} className="rounded-xl">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management */}
          <TabsContent value="users">
            <Card className="border border-border/50 rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <UserCog className="h-5 w-5 text-primary" />
                  </div>
                  User Management
                </CardTitle>
                <CardDescription>
                  View all users and manage their roles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl border-border/60"
                  />
                </div>

                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Roles</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              {searchQuery ? 'No users found matching your search' : 'No users found'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.full_name || 'No name'}</TableCell>
                              <TableCell className="text-muted-foreground">{user.email}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {user.roles.length === 0 ? (
                                    <Badge variant="outline" className="text-muted-foreground">No roles</Badge>
                                  ) : (
                                    user.roles.map((role) => (
                                      <Badge
                                        key={role}
                                        variant={
                                          role === 'superadmin'
                                            ? 'destructive'
                                            : role === 'signatory'
                                            ? 'secondary'
                                            : 'default'
                                        }
                                      >
                                        {role}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditRoles(user)}
                                  className="rounded-xl"
                                >
                                  <UserCog className="h-4 w-4 mr-1" />
                                  Manage Roles
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Logs */}
          <TabsContent value="activity">
            <Card className="border border-border/50 rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  Activity Logs
                </CardTitle>
                <CardDescription>
                  View login history and user actions across the system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by user or action..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="pl-10 rounded-xl border-border/60"
                    />
                  </div>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-border/60 bg-background text-sm"
                  >
                    <option value="all">All Actions</option>
                    {uniqueActions.map((action) => (
                      <option key={action} value={action}>
                        {formatActionLabel(action)}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" onClick={fetchActivityLogs} disabled={loadingLogs} className="rounded-xl">
                    {loadingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                  </Button>
                </div>

                {loadingLogs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead>Date & Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {logSearchQuery || actionFilter !== 'all'
                                ? 'No logs found matching your filters'
                                : 'No activity logs yet'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>{getActionIcon(log.action)}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{log.user_name}</p>
                                  <p className="text-xs text-muted-foreground">{log.user_email}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{formatActionLabel(log.action)}</Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                {log.details && Object.keys(log.details).length > 0 ? (
                                  <span className="text-xs text-muted-foreground truncate block">
                                    {JSON.stringify(log.details).slice(0, 50)}
                                    {JSON.stringify(log.details).length > 50 && '...'}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Showing the last 200 activity logs
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications">
            <Card className="border border-border/50 rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Configure when and how email notifications are sent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Master toggle for all email notifications
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Notification Events</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>New Request Submission</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify signatories when a student submits a request
                      </p>
                    </div>
                    <Switch
                      checked={notifyOnSubmission}
                      onCheckedChange={setNotifyOnSubmission}
                      disabled={!emailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Request Approved</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify students when their request is approved
                      </p>
                    </div>
                    <Switch
                      checked={notifyOnApproval}
                      onCheckedChange={setNotifyOnApproval}
                      disabled={!emailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Request Rejected</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify students when their request is rejected
                      </p>
                    </div>
                    <Switch
                      checked={notifyOnRejection}
                      onCheckedChange={setNotifyOnRejection}
                      disabled={!emailNotifications}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveNotifications} disabled={saving} className="rounded-xl">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <Card className="border border-border/50 rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  Request Rules
                </CardTitle>
                <CardDescription>
                  Configure request processing rules and requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require All Approvals</Label>
                    <p className="text-sm text-muted-foreground">
                      Stored for policy alignment. Student completion already follows every assigned office on their path;
                      future rules may use this flag for partial completion.
                    </p>
                  </div>
                  <Switch
                    checked={requireAllSignatures}
                    onCheckedChange={setRequireAllSignatures}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Multiple Active Requests</Label>
                    <p className="text-sm text-muted-foreground">
                      Students can submit multiple requests simultaneously
                    </p>
                  </div>
                  <Switch
                    checked={allowMultipleClearances}
                    onCheckedChange={setAllowMultipleClearances}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="autoApprove">Auto-Approve After (Days)</Label>
                  <Input
                    id="autoApprove"
                    type="number"
                    min="0"
                    value={autoApproveAfterDays}
                    onChange={(e) => setAutoApproveAfterDays(e.target.value)}
                    placeholder="Leave empty to disable"
                    className="max-w-[200px] rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pending signature rows older than this many days are set to approved by the database function{' '}
                    <code className="rounded bg-muted px-1">auto_approve_stale_clearance_signatures</code>. Deploy the Edge
                    Function <code className="rounded bg-muted px-1">auto-approve-stale-signatures</code>, set secret{' '}
                    <code className="rounded bg-muted px-1">CRON_SECRET</code>, and schedule a daily (or hourly) HTTP call
                    with header <code className="rounded bg-muted px-1">x-cron-secret</code> matching that value. Run{' '}
                    <code className="rounded bg-muted px-1">npm run deploy:function:auto-approve</code> from the project
                    root. Leave empty to disable.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSecurity} disabled={saving} className="rounded-xl">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 rounded-xl shadow-sm mt-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  Official clearance period
                </CardTitle>
                <CardDescription>
                  Students see this window on My Clearance, the calendar, and printable reports. Leave both fields empty
                  if you are not using a fixed period yet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clearancePeriodStart">Start date</Label>
                    <Input
                      id="clearancePeriodStart"
                      type="date"
                      value={clearancePeriodStart}
                      onChange={(e) => setClearancePeriodStart(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clearancePeriodEnd">End date</Label>
                    <Input
                      id="clearancePeriodEnd"
                      type="date"
                      value={clearancePeriodEnd}
                      onChange={(e) => setClearancePeriodEnd(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveClearancePeriod} disabled={saving} className="rounded-xl">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save clearance period
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Role Management Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Manage User Roles</DialogTitle>
              <DialogDescription>
                {selectedUser && (
                  <>
                    Update roles for <span className="font-medium">{selectedUser.full_name || selectedUser.email}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {(['student', 'signatory', 'superadmin'] as AppRole[]).map((role) => (
                <div key={role} className="flex items-center space-x-3">
                  <Checkbox
                    id={`role-${role}`}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <Label htmlFor={`role-${role}`} className="flex-1 cursor-pointer">
                    <span className="font-medium capitalize">{role}</span>
                    <p className="text-sm text-muted-foreground">
                      {role === 'student' && 'Can submit requests'}
                      {role === 'signatory' && 'Can sign requests'}
                      {role === 'superadmin' && 'Full system access and user management'}
                    </p>
                  </Label>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleSaveRoles} disabled={savingRoles} className="rounded-xl">
                {savingRoles ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Roles'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
