import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Mail,
  Database,
  Loader2,
  Save,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin()) {
      navigate('/dashboard');
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
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="general" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
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
      </div>
    </DashboardLayout>
  );
}
