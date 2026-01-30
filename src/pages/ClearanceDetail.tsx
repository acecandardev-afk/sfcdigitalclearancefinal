import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, CheckCircle, Clock, XCircle, Loader2, User, Trash2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import ClearanceProgressTimeline from '@/components/clearance/ClearanceProgressTimeline';
import SignatorySelector from '@/components/clearance/SignatorySelector';

interface Signatory {
  id: string;
  name: string;
  position: string;
  department: string;
}

interface SelectedSignatory extends Signatory {
  order: number;
}

interface Signature {
  id: string;
  signatory_id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  notes: string | null;
  remarks: string | null;
  sequence_order: number;
  signed_at: string | null;
  signatory: {
    name: string;
    position: string;
    department: string;
  };
}

interface ClearanceDetail {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export default function ClearanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clearance, setClearance] = useState<ClearanceDetail | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  
  // Edit mode state
  const [isEditingSequence, setIsEditingSequence] = useState(false);
  const [availableSignatories, setAvailableSignatories] = useState<Signatory[]>([]);
  const [editedSignatories, setEditedSignatories] = useState<SelectedSignatory[]>([]);
  const [savingSequence, setSavingSequence] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchClearanceDetail();
    }
  }, [user, id]);

  const fetchClearanceDetail = async () => {
    try {
      // Fetch clearance request
      const { data: clearanceData, error: clearanceError } = await supabase
        .from('clearance_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (clearanceError) throw clearanceError;
      if (!clearanceData) {
        toast.error('Clearance not found');
        navigate('/dashboard');
        return;
      }

      setClearance(clearanceData);

      // Fetch signatures with signatory details
      const { data: signaturesData, error: signaturesError } = await supabase
        .from('clearance_signatures')
        .select(`
          id,
          signatory_id,
          status,
          notes,
          remarks,
          sequence_order,
          signed_at,
          signatories (
            id,
            name,
            position,
            department
          )
        `)
        .eq('clearance_request_id', id)
        .order('sequence_order', { ascending: true });

      if (signaturesError) throw signaturesError;

      const processedSignatures = signaturesData.map((sig: any) => ({
        ...sig,
        signatory: sig.signatories,
      }));

      setSignatures(processedSignatures);
    } catch (error) {
      console.error('Error fetching clearance:', error);
      toast.error('Failed to load clearance details');
    } finally {
      setLoading(false);
    }
  };

  // Check if clearance can be edited (no signatures have been made yet)
  const canEditSequence = signatures.length > 0 && signatures.every((s) => s.status === 'pending');

  // Check if clearance can be deleted (no signatures have been made)
  const canDelete = signatures.length === 0 || signatures.every((s) => s.status === 'pending');

  // Start editing sequence
  const startEditingSequence = async () => {
    try {
      // Fetch all available signatories
      const { data, error } = await supabase
        .from('signatories')
        .select('id, name, position, department')
        .eq('is_active', true)
        .order('department');

      if (error) throw error;
      setAvailableSignatories(data || []);

      // Convert current signatures to editable format
      const currentSelected: SelectedSignatory[] = signatures.map((sig) => ({
        id: sig.signatory_id,
        name: sig.signatory.name,
        position: sig.signatory.position,
        department: sig.signatory.department,
        order: sig.sequence_order,
      }));
      setEditedSignatories(currentSelected);
      setIsEditingSequence(true);
    } catch (error) {
      console.error('Error fetching signatories:', error);
      toast.error('Failed to load signatories');
    }
  };

  // Cancel editing
  const cancelEditingSequence = () => {
    setIsEditingSequence(false);
    setEditedSignatories([]);
  };

  // Save new sequence
  const saveSequence = async () => {
    if (!id || editedSignatories.length === 0) return;

    setSavingSequence(true);
    try {
      // Delete existing signatures
      const { error: deleteError } = await supabase
        .from('clearance_signatures')
        .delete()
        .eq('clearance_request_id', id);

      if (deleteError) throw deleteError;

      // Insert new signatures with updated order
      const signatureInserts = editedSignatories.map((sig) => ({
        clearance_request_id: id,
        signatory_id: sig.id,
        status: 'pending' as const,
        sequence_order: sig.order,
      }));

      const { error: insertError } = await supabase
        .from('clearance_signatures')
        .insert(signatureInserts);

      if (insertError) throw insertError;

      toast.success('Signing sequence updated successfully');
      setIsEditingSequence(false);
      fetchClearanceDetail(); // Refresh data
    } catch (error) {
      console.error('Error updating sequence:', error);
      toast.error('Failed to update signing sequence');
    } finally {
      setSavingSequence(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    setDeleting(true);
    try {
      // Delete signatures first (due to foreign key)
      const { error: sigError } = await supabase
        .from('clearance_signatures')
        .delete()
        .eq('clearance_request_id', id);
      
      if (sigError) throw sigError;

      // Delete files
      const { error: filesError } = await supabase
        .from('clearance_files')
        .delete()
        .eq('clearance_request_id', id);
      
      if (filesError) throw filesError;

      // Delete the clearance request
      const { error: clearanceError } = await supabase
        .from('clearance_requests')
        .delete()
        .eq('id', id);
      
      if (clearanceError) throw clearanceError;

      toast.success('Clearance request deleted successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting clearance:', error);
      toast.error('Failed to delete clearance request');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="pending">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="in-progress">In Progress</Badge>;
      case 'approved':
        return <Badge variant="approved">Approved</Badge>;
      case 'rejected':
        return <Badge variant="rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-secondary animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-warning" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!clearance) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Clearance not found</h3>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold">{clearance.title}</h1>
              {getStatusBadge(clearance.status)}
            </div>
            <p className="text-muted-foreground mt-1">
              Submitted on{' '}
              {new Date(clearance.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Clearance Request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this clearance request and all associated files. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Description */}
        {clearance.description && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{clearance.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Signatures */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Signing Sequence</CardTitle>
                <CardDescription>
                  {signatures.filter((s) => s.status === 'approved').length} of {signatures.length}{' '}
                  signatures collected (in order)
                </CardDescription>
              </div>
              {canEditSequence && !isEditingSequence && (
                <Button variant="outline" size="sm" onClick={startEditingSequence}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Sequence
                </Button>
              )}
              {isEditingSequence && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEditingSequence} disabled={savingSequence}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button variant="hero" size="sm" onClick={saveSequence} disabled={savingSequence}>
                    {savingSequence ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingSequence ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Drag or use arrows to reorder signatories. You can also add or remove signatories.
                </p>
                <SignatorySelector
                  signatories={availableSignatories}
                  selectedSignatories={editedSignatories}
                  onSelectionChange={setEditedSignatories}
                />
              </div>
            ) : signatures.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No signatures required</p>
            ) : (
              <div className="space-y-6">
                {/* Progress Timeline */}
                <ClearanceProgressTimeline
                  signatures={signatures.map((sig) => ({
                    id: sig.id,
                    status: sig.status,
                    sequence_order: sig.sequence_order,
                    signatory: {
                      name: sig.signatory.name,
                      department: sig.signatory.department,
                    },
                  }))}
                />

                {/* Detailed list */}
                <div className="space-y-4 pt-4 border-t border-border">
                  {signatures.map((sig, index) => {
                    // Check if previous signatories have approved
                    const previousApproved = signatures
                      .filter((s) => s.sequence_order < sig.sequence_order)
                      .every((s) => s.status === 'approved');
                    const isWaiting = sig.status === 'pending' && !previousApproved;
                    
                    return (
                      <div
                        key={sig.id}
                        className={`flex items-center justify-between p-4 rounded-lg border border-border ${
                          isWaiting ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                            {sig.sequence_order}
                          </div>
                          <div className="p-2 bg-muted rounded-full">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold">{sig.signatory.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {sig.signatory.position} • {sig.signatory.department}
                            </p>
                            {sig.notes && (
                              <p className="text-sm text-muted-foreground mt-1 italic">
                                Note: "{sig.notes}"
                              </p>
                            )}
                            {sig.remarks && (
                              <p className="text-sm text-primary mt-1">
                                Remarks: "{sig.remarks}"
                              </p>
                            )}
                            {isWaiting && (
                              <p className="text-xs text-warning mt-1">
                                Waiting for previous signatories
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusIcon(sig.status)}
                          {getStatusBadge(sig.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
