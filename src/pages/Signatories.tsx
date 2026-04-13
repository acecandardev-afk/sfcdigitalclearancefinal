import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUserRole } from '@/hooks/useUserRole';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, Users, Search, UserPlus, KeyRound, ListOrdered, ChevronUp, ChevronDown, UserPlus2 } from 'lucide-react';
import { toast } from 'sonner';

interface Signatory {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

function apiSignatoryToUi(s: any): Signatory {
  return {
    id: String(s.id),
    name: String(s.name ?? ''),
    position: String(s.position ?? ''),
    department: String(s.department ?? ''),
    email: String(s.email ?? ''),
    is_active: Boolean(s.is_active ?? s.isActive ?? false),
    user_id: (s.user_id ?? s.userId ?? null) as string | null,
    created_at: String(s.created_at ?? s.createdAt ?? ''),
  };
}

const signatorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  position: z.string().trim().min(1, 'Position is required').max(100, 'Position must be less than 100 characters'),
  department: z.string().trim().min(1, 'Department is required').max(100, 'Department must be less than 100 characters'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
});

const accountSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters').max(72, 'Password must be less than 72 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignatoryFormData = z.infer<typeof signatorySchema>;
type AccountFormData = z.infer<typeof accountSchema>;

export default function Signatories() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSignatory, setSelectedSignatory] = useState<Signatory | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  // Default signatories for student clearances (admin-assigned order)
  const [defaultSignatories, setDefaultSignatories] = useState<{ id: string; signatory_id: string; sequence_order: number; signatory: Signatory }[]>([]);
  const [defaultOrderLoading, setDefaultOrderLoading] = useState(false);
  const [addDefaultDialogOpen, setAddDefaultDialogOpen] = useState(false);

  const signatoryForm = useForm<SignatoryFormData>({
    resolver: zodResolver(signatorySchema),
    defaultValues: {
      name: '',
      position: '',
      department: '',
      email: '',
    },
  });

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!roleLoading) {
      if (!isSuperAdmin()) {
        navigate('/dashboard');
      } else {
        fetchSignatories();
        fetchDefaultSignatories();
      }
    }
  }, [roleLoading, isSuperAdmin, navigate]);

  const fetchDefaultSignatories = async () => {
    try {
      const res = await fetch('/api/default-signatories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load default signatory order');
      const json = await res.json();
      setDefaultSignatories((json.defaultSignatories || []) as any);
    } catch (error) {
      console.error('Error fetching default signatories:', error);
      toast.error('Failed to load default signatory order');
    }
  };

  const fetchSignatories = async () => {
    try {
      const res = await fetch('/api/signatories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load signatories');
      const json = await res.json();
      setSignatories(((json.signatories || []) as any[]).map(apiSignatoryToUi));
    } catch (error) {
      console.error('Error fetching signatories:', error);
      toast.error('Failed to load signatories');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setSelectedSignatory(null);
    signatoryForm.reset({
      name: '',
      position: '',
      department: '',
      email: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (signatory: Signatory) => {
    setSelectedSignatory(signatory);
    signatoryForm.reset({
      name: signatory.name,
      position: signatory.position,
      department: signatory.department,
      email: signatory.email,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (signatory: Signatory) => {
    setSelectedSignatory(signatory);
    setDeleteDialogOpen(true);
  };

  const openAccountDialog = (signatory: Signatory) => {
    setSelectedSignatory(signatory);
    accountForm.reset({ password: '', confirmPassword: '' });
    setAccountDialogOpen(true);
  };

  const onSignatorySubmit = async (data: SignatoryFormData) => {
    setFormLoading(true);

    try {
      if (selectedSignatory) {
        const res = await fetch(`/api/signatories/${selectedSignatory.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            position: data.position,
            department: data.department,
            email: data.email,
          }),
        });
        if (!res.ok) throw new Error('Failed to update signatory');
        toast.success('Signatory updated successfully');
      } else {
        const res = await fetch('/api/signatories', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            position: data.position,
            department: data.department,
            email: data.email,
            is_active: true,
            signatory_group: 'standard',
          }),
        });
        if (!res.ok) throw new Error('Failed to add signatory');
        toast.success('Signatory added successfully');
      }

      setDialogOpen(false);
      fetchSignatories();
    } catch (error) {
      console.error('Error saving signatory:', error);
      toast.error('Failed to save signatory');
    } finally {
      setFormLoading(false);
    }
  };

  const onAccountSubmit = async (data: AccountFormData) => {
    if (!selectedSignatory) return;

    setFormLoading(true);

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedSignatory.email,
          password: data.password,
          full_name: selectedSignatory.name,
          role: 'signatory',
          signatory_id: selectedSignatory.id,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to create account');

      toast.success('Account created successfully! The signatory can now login.');
      setAccountDialogOpen(false);
      fetchSignatories();
    } catch (error: unknown) {
      console.error('Error creating account:', error);
      toast.error('Failed to create account');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSignatory) return;

    try {
      const res = await fetch(`/api/signatories/${selectedSignatory.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove signatory');
      toast.success('Signatory removed successfully');
      setDeleteDialogOpen(false);
      fetchSignatories();
    } catch (error) {
      console.error('Error deleting signatory:', error);
      toast.error('Failed to remove signatory');
    }
  };

  const toggleStatus = async (signatory: Signatory) => {
    try {
      const res = await fetch(`/api/signatories/${signatory.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !signatory.is_active }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success(`Signatory ${signatory.is_active ? 'deactivated' : 'activated'}`);
      fetchSignatories();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update status');
    }
  };

  const addToDefaultOrder = async (signatory: Signatory) => {
    setDefaultOrderLoading(true);
    try {
      const res = await fetch('/api/default-signatories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatory_id: signatory.id }),
      });
      if (!res.ok) throw new Error('Failed to add signatory to order');
      toast.success(`${signatory.name} added to default request order`);
      setAddDefaultDialogOpen(false);
      fetchDefaultSignatories();
    } catch (error) {
      console.error('Error adding to default order:', error);
      toast.error('Failed to add signatory to order');
    } finally {
      setDefaultOrderLoading(false);
    }
  };

  const removeFromDefaultOrder = async (rowId: string) => {
    setDefaultOrderLoading(true);
    try {
      const res = await fetch(`/api/default-signatories/${rowId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success('Removed from default order');
      fetchDefaultSignatories();
    } catch (error) {
      console.error('Error removing from default order:', error);
      toast.error('Failed to remove');
    } finally {
      setDefaultOrderLoading(false);
    }
  };

  const moveInDefaultOrder = async (index: number, direction: 'up' | 'down') => {
    const list = [...defaultSignatories];
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= list.length) return;
    [list[index].sequence_order, list[swap].sequence_order] = [list[swap].sequence_order, list[index].sequence_order];
    setDefaultOrderLoading(true);
    try {
      const r1 = await fetch(`/api/default-signatories/${list[index].id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence_order: list[index].sequence_order }),
      });
      if (!r1.ok) throw new Error('Failed to update order');
      const r2 = await fetch(`/api/default-signatories/${list[swap].id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence_order: list[swap].sequence_order }),
      });
      if (!r2.ok) throw new Error('Failed to update order');
      toast.success('Order updated');
      fetchDefaultSignatories();
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('Failed to update order');
    } finally {
      setDefaultOrderLoading(false);
    }
  };

  const defaultOrderSignatoryIds = new Set(defaultSignatories.map((d) => d.signatory_id));
  const availableToAdd = signatories.filter((s) => s.is_active && !defaultOrderSignatoryIds.has(s.id));

  const filteredSignatories = signatories.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (roleLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight">Manage Signatories</h1>
            <p className="text-muted-foreground mt-1">Add, edit, or remove signatories. Assign who signs student requests.</p>
          </div>
          <Button onClick={openAddDialog} className="shrink-0 rounded-xl shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Signatory
          </Button>
        </div>

        {/* Default signatories for requests (admin-assigned; students cannot choose) */}
        <Card className="border border-border/50 rounded-xl shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 rounded-lg bg-primary/10">
                <ListOrdered className="h-5 w-5 text-primary" />
              </div>
              Default signatories for student requests
            </CardTitle>
            <CardDescription className="text-muted-foreground/90">
              Students cannot choose signatories. Set the signatories and order for every new request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {defaultSignatories.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border/70 rounded-xl bg-muted/20">
                <p className="text-muted-foreground">No default signatories set.</p>
                <p className="text-sm text-muted-foreground mt-1">Add signatories below; they will sign in the order you set.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {defaultSignatories.map((d, index) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border/80 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{d.signatory.name}</p>
                        <p className="text-sm text-muted-foreground">{d.signatory.position} • {d.signatory.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={defaultOrderLoading || index === 0}
                        onClick={() => moveInDefaultOrder(index, 'up')}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={defaultOrderLoading || index === defaultSignatories.length - 1}
                        onClick={() => moveInDefaultOrder(index, 'down')}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={defaultOrderLoading}
                        onClick={() => removeFromDefaultOrder(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={defaultOrderLoading || availableToAdd.length === 0}
              onClick={() => setAddDefaultDialogOpen(true)}
              className="rounded-xl"
            >
              <UserPlus2 className="h-4 w-4 mr-2" />
              Add signatory to order
            </Button>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search signatories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl border-border/60 focus-visible:ring-2"
          />
        </div>

        {/* Signatories List */}
        <Card className="border border-border/50 rounded-xl shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Signatories ({filteredSignatories.length})
            </CardTitle>
            <CardDescription className="text-muted-foreground/90">
              Authorized personnel who can approve student requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSignatories.length === 0 ? (
              <div className="text-center py-14 border border-dashed border-border/70 rounded-xl bg-muted/20">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-base font-semibold">No signatories found</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {searchQuery ? 'Try a different search term' : 'Add your first signatory to get started'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSignatories.map((signatory) => (
                  <div
                    key={signatory.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border/80 transition-all duration-200 gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{signatory.name}</h4>
                          <Badge variant={signatory.is_active ? 'success' : 'secondary'}>
                            {signatory.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {signatory.user_id ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <KeyRound className="h-3 w-3 mr-1" />
                              Has Account
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                              No Account
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{signatory.position}</p>
                        <p className="text-sm text-muted-foreground">
                          {signatory.department} • {signatory.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-12 sm:ml-0 flex-wrap">
                      {!signatory.user_id && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openAccountDialog(signatory)}
                          className="rounded-xl"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Create Account
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(signatory)}
                        className="rounded-xl"
                      >
                        {signatory.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(signatory)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(signatory)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Signatory Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedSignatory ? 'Edit Signatory' : 'Add New Signatory'}
            </DialogTitle>
            <DialogDescription>
              {selectedSignatory
                ? 'Update the signatory information below.'
                : 'Enter the details for the new signatory.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...signatoryForm}>
            <form onSubmit={signatoryForm.handleSubmit(onSignatorySubmit)} className="space-y-4">
              <FormField
                control={signatoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Juan Dela Cruz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={signatoryForm.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input placeholder="Department Head" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={signatoryForm.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="College of Information Technology" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={signatoryForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="signatory@school.edu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading} className="rounded-xl">
                  {formLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : selectedSignatory ? (
                    'Update'
                  ) : (
                    'Add Signatory'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Account for Signatory</DialogTitle>
            <DialogDescription>
              Create a login account for <strong>{selectedSignatory?.name}</strong>. They will use their email ({selectedSignatory?.email}) to sign in.
            </DialogDescription>
          </DialogHeader>
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
              <FormField
                control={accountForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={accountForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading} className="rounded-xl">
                  {formLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add to default order dialog */}
      <Dialog open={addDefaultDialogOpen} onOpenChange={setAddDefaultDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add signatory to request order</DialogTitle>
            <DialogDescription>
              Choose a signatory to add to the default signing sequence. Only active signatories not already in the list are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No signatories available to add. Add new signatories or activate existing ones.</p>
            ) : (
              availableToAdd.map((sig) => (
                <div
                  key={sig.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/50 hover:border-border/80 cursor-pointer transition-all duration-200"
                  onClick={() => addToDefaultOrder(sig)}
                >
                  <div>
                    <p className="font-medium">{sig.name}</p>
                    <p className="text-sm text-muted-foreground">{sig.position} • {sig.department}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" disabled={defaultOrderLoading}>
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Signatory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{selectedSignatory?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
