import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { User, KeyRound, Loader2, Save, Shield, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { programCourseSelectOptions, yearLevelSelectOptions } from '@/constants/academicOptions';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { friendlyApiErrorMessage, userErrorFromApi } from '@/lib/userMessages';

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
  /** Student: year level; employee: job title (stored in yearLevel) */
  year_level: z.string().trim().optional(),
  /** Student: program; employee: department/office (stored in course) */
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
  const { isStudent, isSignatory, isSuperAdmin, loading: roleLoading } = useUserRole();
  /** Not the student-only self-service line; same idea as `isPureStudent` elsewhere. */
  const isPureStudent = isStudent() && !isSignatory() && !isSuperAdmin();
  /** Employee (non-student-only): faculty, signatories, admins, and mixed roles. */
  const isStaff = !isPureStudent;
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
    if (!user?.id || roleLoading) return;
    let cancelled = false;
    void (async () => {
      setLoadingProfile(true);
      try {
        const res = await fetch('/api/me/profile', { credentials: 'include' });
        if (!res.ok) throw new Error(await friendlyApiErrorMessage(res, 'Could not load your profile.'));
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
  }, [user?.id, profileForm, roleLoading]);

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
      if (!res.ok) throw new Error(userErrorFromApi(json, 'Could not update your profile. Try again.'));
      toast.success('Profile updated successfully');
    } catch (e: unknown) {
      console.error('Error updating profile:', e);
      toast.error(safeActionErrorMessage(e, 'Could not update your profile. Try again.'));
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
        toast.error(userErrorFromApi(json, 'Could not change your password. Check your current password and try again.'));
        setChangingPassword(false);
        return;
      }

      toast.success('Password changed successfully!');
      passwordForm.reset();
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      toast.error(safeActionErrorMessage(error, 'Could not change your password. Check your current password and try again.'));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen bg-gradient-to-br from-slate-50/80 via-blue-50/20 to-transparent px-4 py-6 dark:from-gray-950/50 dark:via-gray-900/30 sm:px-6 lg:px-8">
        <div className="w-full min-w-0 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-3">
            <User className="h-7 w-7 text-primary" />
            Profile & Settings
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

        {/* Profile: student (program) vs employee (institutional) */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {isStaff ? 'Employee profile' : 'Student profile'}
            </CardTitle>
            <CardDescription>
              {isStaff
                ? 'These details identify you in the system and can prefill your institutional (employee) clearance. They are not the student course form.'
                : 'Update your personal and academic information used for student clearance.'}
            </CardDescription>
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

                {isStaff ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={profileForm.control}
                      name="course"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department / office</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Office of the Registrar"
                              {...field}
                              disabled={loadingProfile}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Used when you request institutional clearance.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="year_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Administrative Assistant II"
                              {...field}
                              disabled={loadingProfile}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={profileForm.control}
                      name="year_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year level</FormLabel>
                          <Select
                            disabled={loadingProfile}
                            value={field.value ? field.value : '__none__'}
                            onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select year level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Not set</SelectItem>
                              {yearLevelSelectOptions(field.value).map((y) => (
                                <SelectItem key={y} value={y}>
                                  {y}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <Select
                            disabled={loadingProfile}
                            value={field.value ? field.value : '__none__'}
                            onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select program" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[280px]">
                              <SelectItem value="__none__">Not set</SelectItem>
                              {programCourseSelectOptions(field.value).map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {!isSignatory() && (
                  <>
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
                  </>
                )}

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
                        <PasswordInput placeholder="••••••••" {...field} />
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
                        <PasswordInput placeholder="••••••••" {...field} />
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
                        <PasswordInput placeholder="••••••••" {...field} />
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
      </div>
    </DashboardLayout>
  );
}
