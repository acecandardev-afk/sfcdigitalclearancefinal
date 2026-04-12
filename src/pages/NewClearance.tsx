import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { invokeAuthenticatedFunction } from '@/lib/supabaseInvoke';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Upload, X, Loader2, FileText, Send, User, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface DefaultSignatory {
  id: string;
  name: string;
  position: string;
  department: string;
  order: number;
  signatory_group?: 'standard' | 'authority';
  authority_sequence_order?: number | null;
}

export default function NewClearance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [signatories, setSignatories] = useState<DefaultSignatory[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedSignatoryIds, setSelectedSignatoryIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingSignatories, setLoadingSignatories] = useState(true);
  const [allowNewClearance, setAllowNewClearance] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    fetchSignatoriesForStudent(user.id);

    (async () => {
      try {
        const sb: typeof supabase & { from: (table: string) => any } = supabase as any;
        const { data: security } = await sb
          .from('system_settings')
          .select('value_json')
          .eq('key', 'security')
          .maybeSingle();
        const allowMultiple = (security?.value_json as { allow_multiple_clearances?: boolean } | null)?.allow_multiple_clearances ?? false;
        if (allowMultiple) {
          setAllowNewClearance(true);
          return;
        }
        const { count } = await supabase
          .from('clearance_requests')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', user.id)
          .in('status', ['pending', 'in_progress']);
        setAllowNewClearance((count ?? 0) === 0);
      } catch {
        setAllowNewClearance(true);
      }
    })();
  }, [user?.id]);

  const fetchSignatoriesForStudent = async (studentId: string) => {
    try {
      setLoadingSignatories(true);

      const { data: assignmentData } = await supabase
        .from('student_signatory_assignments')
        .select('signatory_id, sequence_order, signatory_group, signatories(id, name, position, department, signatory_group, authority_sequence_order)')
        .eq('student_id', studentId)
        .order('sequence_order', { ascending: true });

      if (assignmentData && assignmentData.length > 0) {
        const rows = assignmentData as any[];
        const list: DefaultSignatory[] = rows
          .filter((row) => row?.signatories)
          .map((row) => ({
            id: String(row.signatories.id),
            name: String(row.signatories.name),
            position: String(row.signatories.position),
            department: String(row.signatories.department),
            order: Number(row.sequence_order),
            signatory_group: row.signatories.signatory_group === 'authority' ? 'authority' : 'standard',
            authority_sequence_order: row.signatories.authority_sequence_order ?? null,
          }));
        setSignatories(list);
        setSelectedSignatoryIds(new Set(list.map((s) => s.id)));
        setLoadingSignatories(false);
        return;
      }

      const { data: defaultData, error } = await supabase
        .from('clearance_default_signatories')
        .select('signatory_id, sequence_order, signatories(id, name, position, department, signatory_group, authority_sequence_order)')
        .order('sequence_order', { ascending: true });

      if (error) throw error;

      const rows = (defaultData as any[] | null | undefined) ?? [];
      const list: DefaultSignatory[] = rows
        .filter((row) => row?.signatories)
        .map((row) => ({
          id: String(row.signatories.id),
          name: String(row.signatories.name),
          position: String(row.signatories.position),
          department: String(row.signatories.department),
          order: Number(row.sequence_order),
          signatory_group: row.signatories.signatory_group === 'authority' ? 'authority' : 'standard',
          authority_sequence_order: row.signatories.authority_sequence_order ?? null,
        }));
      setSignatories(list);
      setSelectedSignatoryIds(new Set(list.map((s) => s.id)));
    } catch (error) {
      console.error('Error fetching signatories:', error);
      toast.error('Failed to load signatories. Please contact the administrator.');
    } finally {
      setLoadingSignatories(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSelectAll = () => {
    if (selectedSignatoryIds.size === signatories.length) {
      setSelectedSignatoryIds(new Set());
    } else {
      setSelectedSignatoryIds(new Set(signatories.map((s) => s.id)));
    }
  };

  const toggleSignatory = (id: string) => {
    setSelectedSignatoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (allowNewClearance === false) {
      toast.error('Only one pending clearance is allowed. Complete or cancel your current request first.');
      return;
    }
    if (selectedSignatoryIds.size === 0) {
      toast.error('Select at least one signatory to request.');
      return;
    }
    if (signatories.length === 0) {
      toast.error('No signatories have been assigned yet. Please contact the administrator.');
      return;
    }

    setLoading(true);
    try {
      const title = customMessage.trim() || `Clearance Request - ${new Date().toLocaleDateString('en-US')}`;

      const { data: clearanceData, error: clearanceError } = await supabase
        .from('clearance_requests')
        .insert({
          student_id: user?.id,
          title,
          description: customMessage.trim() || null,
          status: 'pending',
        })
        .select()
        .single();

      if (clearanceError) throw clearanceError;

      for (const file of files) {
        const filePath = `${user?.id}/${clearanceData.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('clearance-files')
          .upload(filePath, file);
        if (uploadError) continue;
        await supabase.from('clearance_files').insert({
          clearance_request_id: clearanceData.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });
      }

      const selectedSignatories = signatories.filter((s) => selectedSignatoryIds.has(s.id));
      const signatureInserts = selectedSignatories.map((sig) => ({
        clearance_request_id: clearanceData.id,
        signatory_id: sig.id,
        status: 'pending' as const,
        sequence_order: sig.order,
        signatory_group: sig.signatory_group || 'standard',
        authority_sequence_order: sig.authority_sequence_order ?? null,
      }));

      const { error: signaturesError } = await supabase
        .from('clearance_signatures')
        .insert(signatureInserts);

      if (signaturesError) throw signaturesError;

      void invokeAuthenticatedFunction('notify-signatories', {
        clearance_request_id: clearanceData.id,
        signatory_ids: selectedSignatories.map((s) => s.id),
      }).catch(console.error);

      toast.success('Clearance request submitted! View status in My Requests.');
      navigate('/dashboard/clearances');
    } catch (error) {
      console.error('Error creating clearance:', error);
      toast.error('Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="app-page">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
              New Clearance Request
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Upload documents and choose signatories for your request
            </p>
          </div>
        </div>

        {allowNewClearance === false && (
          <Card className="app-surface mb-6 border-warning/30 bg-warning/5">
            <CardContent className="pt-6">
              <p className="font-medium">Only one pending request at a time is allowed.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete or cancel your current request before submitting a new one.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/clearances')}>
                View my clearances
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          <div className="xl:col-span-1 space-y-6">
            <Card className="app-surface">
              <CardHeader className="pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2.5 text-primary">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Supporting Documents</CardTitle>
                    <CardDescription>Upload any required documents for your clearance</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <label className="block">
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/40">
                    <input type="file" multiple onChange={handleFileChange} className="hidden" />
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium text-sm">Click to upload files</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, or images</p>
                  </div>
                </label>
                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/60"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          className="shrink-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardHeader className="pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2.5 text-primary">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Custom Message</CardTitle>
                    <CardDescription>Optional note to include with your request</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <Textarea
                  placeholder="Add any notes or context for the signatories..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  className="rounded-lg resize-none"
                />
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-2">
            <Card className="app-surface h-full flex flex-col">
              <CardHeader className="pb-4 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2.5 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">Required Signatories</CardTitle>
                      <CardDescription>Select signatories to send your clearance request to</CardDescription>
                    </div>
                  </div>
                  {signatories.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all"
                          checked={selectedSignatoryIds.size === signatories.length}
                          onCheckedChange={toggleSelectAll}
                        />
                        <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                          Select all
                        </label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {selectedSignatoryIds.size} of {signatories.length} selected
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-1 flex flex-col">
                {loadingSignatories ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : signatories.length === 0 ? (
                  <div className="text-center py-16 rounded-xl bg-muted/30 border border-dashed border-border">
                    <User className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 font-medium">No signatories assigned</p>
                    <p className="text-sm text-muted-foreground mt-1">Contact the administrator to set up signatories.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {signatories.map((sig, index) => {
                      const isSelected = selectedSignatoryIds.has(sig.id);
                      return (
                        <div
                          key={sig.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border/60 bg-card hover:bg-muted/30'
                          }`}
                          onClick={() => toggleSignatory(sig.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSignatory(sig.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`flex items-center justify-center h-9 w-9 rounded-full text-sm font-semibold shrink-0 ${
                                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{sig.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {sig.position} • {sig.department}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-lg shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSignatory(sig.id);
                            }}
                          >
                            {isSelected ? 'Selected' : 'Request'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                  <Button variant="outline" onClick={() => navigate(-1)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      signatories.length === 0 ||
                      selectedSignatoryIds.size === 0 ||
                      allowNewClearance === false
                    }
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit request ({selectedSignatoryIds.size} signatories)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
