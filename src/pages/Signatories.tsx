import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Pencil, Trash2, Loader2, Users, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Signatory {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export default function Signatories() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSignatory, setSelectedSignatory] = useState<Signatory | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!roleLoading) {
      if (!isSuperAdmin()) {
        navigate('/dashboard');
      } else {
        fetchSignatories();
      }
    }
  }, [roleLoading, isSuperAdmin, navigate]);

  const fetchSignatories = async () => {
    try {
      const { data, error } = await supabase
        .from('signatories')
        .select('*')
        .order('department')
        .order('name');

      if (error) throw error;
      setSignatories(data || []);
    } catch (error) {
      console.error('Error fetching signatories:', error);
      toast.error('Failed to load signatories');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setSelectedSignatory(null);
    setName('');
    setPosition('');
    setDepartment('');
    setEmail('');
    setDialogOpen(true);
  };

  const openEditDialog = (signatory: Signatory) => {
    setSelectedSignatory(signatory);
    setName(signatory.name);
    setPosition(signatory.position);
    setDepartment(signatory.department);
    setEmail(signatory.email);
    setDialogOpen(true);
  };

  const openDeleteDialog = (signatory: Signatory) => {
    setSelectedSignatory(signatory);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !position || !department || !email) {
      toast.error('Please fill in all fields');
      return;
    }

    setFormLoading(true);

    try {
      if (selectedSignatory) {
        // Update existing
        const { error } = await supabase
          .from('signatories')
          .update({ name, position, department, email })
          .eq('id', selectedSignatory.id);

        if (error) throw error;
        toast.success('Signatory updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('signatories')
          .insert({ name, position, department, email, is_active: true });

        if (error) throw error;
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

  const handleDelete = async () => {
    if (!selectedSignatory) return;

    try {
      const { error } = await supabase
        .from('signatories')
        .delete()
        .eq('id', selectedSignatory.id);

      if (error) throw error;
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
      const { error } = await supabase
        .from('signatories')
        .update({ is_active: !signatory.is_active })
        .eq('id', signatory.id);

      if (error) throw error;
      toast.success(`Signatory ${signatory.is_active ? 'deactivated' : 'activated'}`);
      fetchSignatories();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update status');
    }
  };

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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Manage Signatories</h1>
            <p className="text-muted-foreground">Add, edit, or remove authorized signatories</p>
          </div>
          <Button variant="hero" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Signatory
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search signatories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Signatories List */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Signatories ({filteredSignatories.length})
            </CardTitle>
            <CardDescription>
              Authorized personnel who can approve student clearances
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSignatories.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No signatories found</h3>
                <p className="text-muted-foreground mt-2">
                  {searchQuery ? 'Try a different search term' : 'Add your first signatory to get started'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSignatories.map((signatory, index) => (
                  <div
                    key={signatory.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors gap-4 animate-slide-up"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{signatory.name}</h4>
                          <Badge variant={signatory.is_active ? 'success' : 'secondary'}>
                            {signatory.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{signatory.position}</p>
                        <p className="text-sm text-muted-foreground">
                          {signatory.department} • {signatory.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-12 sm:ml-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(signatory)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {selectedSignatory ? 'Edit Signatory' : 'Add New Signatory'}
            </DialogTitle>
            <DialogDescription>
              {selectedSignatory
                ? 'Update the signatory information below.'
                : 'Enter the details for the new signatory.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Juan Dela Cruz"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Department Head"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="College of Information Technology"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="signatory@school.edu"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading}>
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
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
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
