import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { User, KeyRound, Loader2, Save, Shield, Mail } from 'lucide-react';
import { toast } from 'sonner';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(72, 'Password must be less than 72 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required'),
  year_level: z.string().trim().optional(),
  course: z.string().trim().optional(),
  address: z.string().trim().optional(),
  age: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null) return undefined;
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      return Number.isFinite(n) ? n : undefined;
    })
    .refine((v) => v === undefined || (v >= 1 && v <= 120), 'Age must be between 1 and 120'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function AccountSettings() {
  const { user } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      year_level: '',
      course: '',
      address: '',
      age: undefined,
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      setLoadingProfile(true);
      try {
        const res = await fetch('/api/me/profile', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load profile');
        const json = await res.json();
        if (cancelled) return;
        const row = (json.profile || {}) as any;
        profileForm.reset({
          full_name: row?.full_name || '',
          year_level: row?.year_level || '',
          course: row?.course || '',
          address: row?.address || '',
          age: row?.age ?? undefined,
        });
      } catch (e) {
        console.error('Error loading profile:', e);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profileForm]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: data.full_name,
          year_level: data.year_level || null,
          course: data.course || null,
          address: data.address || null,
          age: (data.age ?? null) as any,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to update profile');
      toast.success('Profile updated successfully');
    } catch (e: unknown) {
      console.error('Error updating profile:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setChangingPassword(true);

    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: data.currentPassword,
          new_password: data.newPassword,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String(json?.error || 'Failed to change password');
        toast.error(msg);
        setChangingPassword(false);
        return;
      }

      toast.success('Password changed successfully!');
      passwordForm.reset();
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-3">
            <User className="h-7 w-7 text-primary" />
            Account Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and security settings
          </p>
        </div>

        {/* Account Info */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Account Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email Address</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile
            </CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your full name" {...field} disabled={loadingProfile} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="year_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year level</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1st Year" {...field} disabled={loadingProfile} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="course"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. BSIT" {...field} disabled={loadingProfile} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={profileForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Your address" {...field} disabled={loadingProfile} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="e.g. 18"
                          {...field}
                          value={field.value === undefined ? '' : String(field.value)}
                          disabled={loadingProfile}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={savingProfile || loadingProfile}>
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={changingPassword}>
                    {changingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4 mr-2" />
                        Change Password
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
