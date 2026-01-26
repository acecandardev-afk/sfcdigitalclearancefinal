import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Upload, X, Loader2, FileText, Send, Eye, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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

const clearanceSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string()
    .trim()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
});

type ClearanceFormData = z.infer<typeof clearanceSchema>;

export default function NewClearance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [selectedSignatories, setSelectedSignatories] = useState<SelectedSignatory[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSignatories, setLoadingSignatories] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingData, setPendingData] = useState<ClearanceFormData | null>(null);
  const [signatoryError, setSignatoryError] = useState<string | null>(null);

  const form = useForm<ClearanceFormData>({
    resolver: zodResolver(clearanceSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  useEffect(() => {
    fetchSignatories();
  }, []);

  const fetchSignatories = async () => {
    try {
      const { data, error } = await supabase
        .from('signatories')
        .select('id, name, position, department')
        .eq('is_active', true)
        .order('department');

      if (error) throw error;
      setSignatories(data || []);
    } catch (error) {
      console.error('Error fetching signatories:', error);
      toast.error('Failed to load signatories');
    } finally {
      setLoadingSignatories(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Show confirmation dialog instead of submitting directly
  const handleReviewSubmit = async (data: ClearanceFormData) => {
    // Validate signatories manually
    if (selectedSignatories.length === 0) {
      setSignatoryError('Please select at least one signatory');
      return;
    }
    setSignatoryError(null);
    setPendingData(data);
    setConfirmDialogOpen(true);
  };

  const onSubmit = async () => {
    if (!pendingData) return;
    const data = pendingData;
    
    setLoading(true);
    setConfirmDialogOpen(false);

    try {
      // Create clearance request
      const { data: clearanceData, error: clearanceError } = await supabase
        .from('clearance_requests')
        .insert({
          student_id: user?.id,
          title: data.title,
          description: data.description || null,
          status: 'pending',
        })
        .select()
        .single();

      if (clearanceError) throw clearanceError;

      // Upload files if any
      for (const file of files) {
        const filePath = `${user?.id}/${clearanceData.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('clearance-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('File upload error:', uploadError);
          continue;
        }

        // Save file record
        await supabase.from('clearance_files').insert({
          clearance_request_id: clearanceData.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });
      }

      // Create signature requests with sequence order
      const signatureInserts = selectedSignatories.map((sig) => ({
        clearance_request_id: clearanceData.id,
        signatory_id: sig.id,
        status: 'pending' as const,
        sequence_order: sig.order,
      }));

      const { error: signaturesError } = await supabase
        .from('clearance_signatures')
        .insert(signatureInserts);

      if (signaturesError) throw signaturesError;

      // Send email notifications to signatories (fire and forget)
      supabase.functions.invoke('notify-signatories', {
        body: {
          clearance_request_id: clearanceData.id,
          signatory_ids: selectedSignatories.map((s) => s.id),
        },
      }).then((result) => {
        if (result.error) {
          console.error('Failed to send notifications:', result.error);
        }
      });

      toast.success('Clearance request submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating clearance:', error);
      toast.error('Failed to create clearance request');
    } finally {
      setLoading(false);
      setPendingData(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">New Clearance Request</h1>
            <p className="text-muted-foreground">Submit your clearance for approval</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleReviewSubmit)} className="space-y-6">
            {/* Basic Info */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-lg">Request Details</CardTitle>
                <CardDescription>Provide information about your clearance request</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Semester Clearance - 2nd Sem 2024"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any additional notes or context..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-lg">Supporting Documents</CardTitle>
                <CardDescription>Upload any required documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium">Click to upload files</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, or images</p>
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signatories */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-lg">Required Signatories *</CardTitle>
                <CardDescription>
                  Select the signatories who need to approve your clearance. They will sign in the order you set.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSignatories ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : signatories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No signatories available</p>
                  </div>
                ) : (
                  <SignatorySelector
                    signatories={signatories}
                    selectedSignatories={selectedSignatories}
                    onSelectionChange={(selected) => {
                      setSelectedSignatories(selected);
                      if (selected.length > 0) {
                        setSignatoryError(null);
                      }
                    }}
                  />
                )}
                {signatoryError && (
                  <p className="text-sm font-medium text-destructive mt-2">{signatoryError}</p>
                )}
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" variant="hero" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Review & Submit
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Confirm Submission</DialogTitle>
              <DialogDescription>
                Please review your clearance request before submitting
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Title & Description */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Title</h4>
                  <p className="font-medium">{pendingData?.title}</p>
                </div>
                
                {pendingData?.description && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                    <p className="text-sm">{pendingData.description}</p>
                  </div>
                )}

                <Separator />

                {/* Files */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Attached Files ({files.length})
                  </h4>
                  {files.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No files attached</p>
                  ) : (
                    <div className="space-y-1">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{file.name}</span>
                          <span className="text-muted-foreground">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Signatories with sequence */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Signing Sequence ({selectedSignatories.length} signatories)
                  </h4>
                  <div className="space-y-2">
                    {selectedSignatories.map((sig) => (
                      <div key={sig.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {sig.order}
                        </div>
                        <div className="p-1.5 bg-primary/10 rounded-full">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sig.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {sig.position} • {sig.department}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Each signatory can only sign after the previous one has approved.
                  </p>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Go Back
              </Button>
              <Button variant="hero" onClick={onSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
