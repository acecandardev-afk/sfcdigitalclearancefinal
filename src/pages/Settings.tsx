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
} from 'lucide-react';
import { toast } from 'sonner';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
}

export default function Settings() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [saving, setSaving] = useState(false);

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

  // User management state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

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

      toast.success('User roles updated successfully');
      setRoleDialogOpen(false);
      fetchUsers();
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

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin()) {
      navigate('/dashboard');
    } else if (!roleLoading && isSuperAdmin()) {
      fetchUsers();
    }
  }, [roleLoading, isSuperAdmin, navigate]);

  const handleSaveGeneral = async () => {
    setSaving(true);
    // Simulate API call - in production, save to database
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success('General settings saved successfully');
    setSaving(false);
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success('Notification settings saved successfully');
    setSaving(false);
  };

  const handleSaveSecurity = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success('Security settings saved successfully');
    setSaving(false);
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

  if (!isSuperAdmin()) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-3">
            <SettingsIcon className="h-7 w-7 text-primary" />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure system-wide settings and preferences
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="general" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display">General Settings</CardTitle>
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
                  />
                  <p className="text-xs text-muted-foreground">
                    This email receives system notifications and error reports
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveGeneral} disabled={saving}>
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
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-primary" />
                  User Management
                </CardTitle>
                <CardDescription>
                  View all users and manage their roles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
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

          {/* Notification Settings */}
          <TabsContent value="notifications">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
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
                      <Label>New Clearance Submission</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify signatories when a student submits a clearance
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
                      <Label>Clearance Approved</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify students when their clearance is approved
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
                      <Label>Clearance Rejected</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify students when their clearance is rejected
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
                  <Button onClick={handleSaveNotifications} disabled={saving}>
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
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Clearance Rules
                </CardTitle>
                <CardDescription>
                  Configure clearance processing rules and requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require All Signatures</Label>
                    <p className="text-sm text-muted-foreground">
                      Students must collect all required signatures for approval
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
                    <Label>Allow Multiple Active Clearances</Label>
                    <p className="text-sm text-muted-foreground">
                      Students can submit multiple clearance requests simultaneously
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
                    className="max-w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically approve pending signatures after this many days. Leave empty to disable.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSecurity} disabled={saving}>
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
        </Tabs>

        {/* Role Management Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
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
                      {role === 'student' && 'Can submit clearance requests'}
                      {role === 'signatory' && 'Can sign clearance requests'}
                      {role === 'superadmin' && 'Full system access and user management'}
                    </p>
                  </Label>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRoles} disabled={savingRoles}>
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
