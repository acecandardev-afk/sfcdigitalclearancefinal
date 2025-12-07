import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Upload, X, Loader2, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Signatory {
  id: string;
  name: string;
  position: string;
  department: string;
}

export default function NewClearance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [selectedSignatories, setSelectedSignatories] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSignatories, setLoadingSignatories] = useState(true);

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

  const toggleSignatory = (id: string) => {
    setSelectedSignatories((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (selectedSignatories.length === 0) {
      toast.error('Please select at least one signatory');
      return;
    }

    setLoading(true);

    try {
      // Create clearance request
      const { data: clearanceData, error: clearanceError } = await supabase
        .from('clearance_requests')
        .insert({
          student_id: user?.id,
          title: title.trim(),
          description: description.trim() || null,
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

      // Create signature requests
      const signatureInserts = selectedSignatories.map((signatoryId) => ({
        clearance_request_id: clearanceData.id,
        signatory_id: signatoryId,
        status: 'pending' as const,
      }));

      const { error: signaturesError } = await supabase
        .from('clearance_signatures')
        .insert(signatureInserts);

      if (signaturesError) throw signaturesError;

      toast.success('Clearance request submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating clearance:', error);
      toast.error('Failed to create clearance request');
    } finally {
      setLoading(false);
    }
  };

  // Group signatories by department
  const groupedSignatories = signatories.reduce((acc, sig) => {
    if (!acc[sig.department]) {
      acc[sig.department] = [];
    }
    acc[sig.department].push(sig);
    return acc;
  }, {} as Record<string, Signatory[]>);

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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-lg">Request Details</CardTitle>
              <CardDescription>Provide information about your clearance request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Semester Clearance - 2nd Sem 2024"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add any additional notes or context..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
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
              <CardDescription>Select the signatories who need to approve your clearance</CardDescription>
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
                <div className="space-y-6">
                  {Object.entries(groupedSignatories).map(([department, sigs]) => (
                    <div key={department}>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                        {department}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sigs.map((sig) => (
                          <div
                            key={sig.id}
                            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedSignatories.includes(sig.id)
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/30'
                            }`}
                            onClick={() => toggleSignatory(sig.id)}
                          >
                            <Checkbox
                              checked={selectedSignatories.includes(sig.id)}
                              onCheckedChange={() => toggleSignatory(sig.id)}
                            />
                            <div>
                              <p className="font-medium">{sig.name}</p>
                              <p className="text-sm text-muted-foreground">{sig.position}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
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
                  <Send className="h-4 w-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
