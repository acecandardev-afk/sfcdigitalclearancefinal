import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronDown, ChevronUp, Loader2, Plus, Save, Archive } from 'lucide-react';
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
import DashboardLayout from '@/components/layout/DashboardLayout';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { friendlyApiErrorMessage, friendlyFetchError, userErrorFromApi } from '@/lib/userMessages';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { toast } from 'sonner';

type Def = {
  id: string;
  sortOrder: number;
  departmentLabel: string;
  signatoryId: string | null;
  signatory: { id: string; name: string; department: string; position: string } | null;
};

type SignOpt = { id: string; name: string; department: string; email: string; isActive: boolean };

export default function InstitutionalOfficeSettingsPage() {
  const [rows, setRows] = useState<Def[]>([]);
  const [signOptions, setSignOptions] = useState<SignOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newSignId, setNewSignId] = useState<string>('');
  const [drafts, setDrafts] = useState<Record<string, { label: string; signatoryId: string }>>({});
  const [archiveRowId, setArchiveRowId] = useState<string | null>(null);

  const labelFor = (d: Def) => (drafts[d.id]?.label !== undefined ? drafts[d.id]!.label : d.departmentLabel);
  const signatoryValFor = (d: Def) => {
    if (drafts[d.id]?.signatoryId !== undefined) return drafts[d.id]!.signatoryId;
    return d.signatoryId ?? '';
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [dRes, sRes] = await Promise.all([
        fetch('/api/institutional/office-definitions', { credentials: 'include' }),
        fetch('/api/signatories?active_only=1', { credentials: 'include' }),
      ]);
      const dJ = await parseResponseJson(dRes);
      const sJ = await parseResponseJson(sRes);
      if (!dRes.ok) throw new Error(await friendlyApiErrorMessage(dRes, 'Failed to load rows'));
      if (sRes.ok) {
        const list = (sJ.signatories ?? []) as any[];
        setSignOptions(
          list
            .filter((s) => s.isActive !== false && s.is_active !== false)
            .map((s) => ({
              id: String(s.id),
              name: String(s.name ?? ''),
              department: String(s.department ?? ''),
              email: String(s.email ?? ''),
              isActive: true,
            }))
        );
      }
      setRows((dJ.definitions ?? []) as Def[]);
    } catch (e) {
      setErr(friendlyFetchError(e));
      toast.error('Could not load office template');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (id: string, part: Partial<{ label: string; signatoryId: string }>) => {
    setDrafts((p) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return p;
      const cur = p[id];
      return {
        ...p,
        [id]: {
          label: part.label !== undefined ? part.label : (cur?.label ?? row.departmentLabel),
          signatoryId:
            part.signatoryId !== undefined
              ? part.signatoryId
              : (cur?.signatoryId ?? (row.signatoryId ?? '')),
        },
      };
    });
  };

  const saveRow = async (d: Def) => {
    const signatoryId = signatoryValFor(d).trim();
    const body = {
      departmentLabel: labelFor(d).trim(),
      signatoryId,
    };
    if (!body.departmentLabel) {
      toast.error('Office name is required');
      return;
    }
    if (!signatoryId) {
      toast.error('Select a signatory for this office');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/institutional/office-definitions/${d.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentLabel: body.departmentLabel, signatoryId: body.signatoryId }),
      });
      const j = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(userErrorFromApi(j, 'Could not save this office row.'));
      }
      toast.success('Row saved');
      setDrafts((p) => {
        const n = { ...p };
        delete n[d.id];
        return n;
      });
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const archiveRow = async (rowId: string) => {
    setArchiveRowId(rowId);
  };

  const confirmArchiveRow = async () => {
    if (!archiveRowId) return;
    const rowId = archiveRowId;
    setArchiveRowId(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/institutional/office-definitions/${rowId}/archive`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      if (!res.ok) {
        const j = await parseResponseJson(res);
        throw new Error(userErrorFromApi(j, 'Could not archive this office row.'));
      }
      toast.success('Office archived');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not archive this office row.'));
    } finally {
      setSaving(false);
    }
  };

  const rowBeingArchived = rows.find((r) => r.id === archiveRowId);

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const t = next[index];
    next[index] = next[j];
    next[j] = t;
    setRows(next);
    setSaving(true);
    try {
      const res = await fetch('/api/institutional/office-definitions/reorder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: next.map((r) => r.id) }),
      });
      if (!res.ok) {
        const p = await parseResponseJson(res);
        throw new Error(userErrorFromApi(p, 'Could not update the office order.'));
      }
      toast.success('Order updated');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not save. Try again.'));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const addRow = async () => {
    const label = newLabel.trim();
    if (!label) {
      toast.error('Enter an office or department name');
      return;
    }
    if (!newSignId.trim()) {
      toast.error('Select a signatory for this office');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/institutional/office-definitions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentLabel: label,
          signatoryId: newSignId.trim(),
        }),
      });
      const j = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(userErrorFromApi(j, 'Could not add this office row.'));
      }
      setNewLabel('');
      setNewSignId('');
      toast.success('Row added');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full min-w-0 space-y-6">
          <Button asChild type="button" variant="ghost" className="gap-1 -ml-2">
            <Link to="/dashboard/institutional/admin">
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Link>
          </Button>
          <InstitutionalPageBrand
            title="Institutional — office template"
            subtitle="Section II row order and signatory assignment. Only applies to new clearances. Each office must have a signatory so their queue shows the correct line when it is that step."
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-[#1e3a5f] dark:text-sky-400">
                  <Building2 className="h-5 w-5" />
                  <CardTitle className="text-lg">Offices in order</CardTitle>
                </div>
                <CardDescription>
                  {rows.length} row{rows.length === 1 ? '' : 's'}. Reorder with arrows; save per row.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rows.map((r, idx) => {
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/80 p-3 sm:flex-row sm:items-end sm:flex-wrap"
                    >
                      <div className="flex gap-1 shrink-0">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-9 w-9"
                          disabled={saving || idx === 0}
                          onClick={() => void move(idx, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-9 w-9"
                          disabled={saving || idx === rows.length - 1}
                          onClick={() => void move(idx, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground w-6 flex items-center justify-center">#{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-[200px] space-y-1">
                        <Label className="text-xs">Office / department</Label>
                        <Input
                          value={labelFor(r)}
                          onChange={(e) => updateDraft(r.id, { label: e.target.value })}
                        />
                      </div>
                      <div className="w-full sm:w-64 space-y-1">
                        <Label className="text-xs">Signatory</Label>
                        <Select
                          value={signatoryValFor(r) || undefined}
                          onValueChange={(v) => updateDraft(r.id, { signatoryId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select signatory" />
                          </SelectTrigger>
                          <SelectContent>
                            {signOptions.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} — {s.department}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveRow(r)}
                          disabled={saving}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void archiveRow(r.id)}
                          disabled={saving}
                          title="Archive office"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-border space-y-2">
                  <h3 className="text-sm font-medium">Add office</h3>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <div className="flex-1 space-y-1">
                      <Label>Label</Label>
                      <Input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="e.g. Alumni Office"
                      />
                    </div>
                    <div className="w-full sm:w-64 space-y-1">
                      <Label>Signatory</Label>
                      <Select value={newSignId || undefined} onValueChange={setNewSignId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select signatory" />
                        </SelectTrigger>
                        <SelectContent>
                          {signOptions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" onClick={() => void addRow()} disabled={saving}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <AlertDialog open={!!archiveRowId} onOpenChange={(open) => { if (!open) setArchiveRowId(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this office?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{rowBeingArchived?.departmentLabel}</strong> will be removed from the clearance template. New
              clearance requests will no longer include it. Existing records are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmArchiveRow()}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
