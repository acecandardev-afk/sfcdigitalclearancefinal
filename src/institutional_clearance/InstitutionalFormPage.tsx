import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useMeProfile } from '@/hooks/useMeProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INSTITUTIONAL_CLEARANCE_OFFICE_ROWS, EMPLOYEE_TYPE_OPTIONS, REASON_CATEGORY_OPTIONS } from '@/lib/institutionalOffices';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { friendlyApiErrorMessage, userErrorFromApi } from '@/lib/userMessages';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { toast } from 'sonner';

function dateInputToIso(dateStr: string) {
  if (!dateStr) return '';
  return new Date(`${dateStr}T12:00:00.000Z`).toISOString();
}

function isoToDateInput(iso: string) {
  try {
    return iso.slice(0, 10);
  } catch {
    return '';
  }
}

type ReasonCat = (typeof REASON_CATEGORY_OPTIONS)[number]['value'];
type EmpType = (typeof EMPLOYEE_TYPE_OPTIONS)[number]['value'];

export default function InstitutionalFormPage() {
  const { data: session } = useSession();
  const { profile, loading: profileLoading } = useMeProfile(true);
  const { isSignatory, isSuperAdmin } = useUserRole();
  const { id: routeId } = useParams<{ id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isEdit = Boolean(
    routeId && routeId !== 'new' && /\/edit\/?$/.test(location.pathname)
  );

  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [employeeType, setEmployeeType] = useState<EmpType>('teaching');
  const [department, setDepartment] = useState('');
  const [dateOfSep, setDateOfSep] = useState('');
  const [reasonCategory, setReasonCategory] = useState<ReasonCat>('resignation');
  const [reasonOtherDetails, setReasonOtherDetails] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const editId = isEdit && routeId ? routeId : null;

  useEffect(() => {
    if (editId || profileLoading || prefilled) return;
    setFullName((prev) => (prev.trim() ? prev : profile?.full_name?.trim() || session?.user?.name?.trim() || ''));
    // Employee profile: `course` = department/office, `year_level` = position (see Account Settings).
    setDepartment((prev) => (prev.trim() ? prev : profile?.course?.trim() || ''));
    setPosition((prev) => (prev.trim() ? prev : profile?.year_level?.trim() || ''));
    setPrefilled(true);
  }, [editId, profileLoading, prefilled, profile, session?.user?.name]);

  useEffect(() => {
    if (!editId) return;
    let c = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/institutional/clearances/${editId}`, { credentials: 'include' });
        const j = (await parseResponseJson(res)) as {
          clearance?: {
            status: string;
            fullName: string;
            position: string;
            department: string;
            employeeType: string | null;
            dateOfSeparation: string | null;
            reasonCategory: string | null;
            reasonOtherDetails: string | null;
            reason: string | null;
          };
        };
        if (!res.ok) throw new Error(await friendlyApiErrorMessage(res, 'Could not load this clearance.'));
        const cl = j.clearance;
        if (!cl) throw new Error('Could not load this clearance.');
        if (!c) return;
        if (cl.status !== 'draft') {
          toast.error('Only draft clearances can be edited.');
          navigate(`/dashboard/institutional/clearances/${editId}`, { replace: true });
          return;
        }
        setFullName(cl.fullName);
        setPosition(cl.position);
        setDepartment(cl.department);
        setEmployeeType((cl.employeeType as EmpType) || 'teaching');
        setDateOfSep(isoToDateInput(cl.dateOfSeparation || ''));
        setReasonCategory((cl.reasonCategory as ReasonCat) || 'resignation');
        setReasonOtherDetails(cl.reasonOtherDetails || '');
        setReason(cl.reason || '');
      } catch {
        if (c) toast.error('Could not load clearance');
      } finally {
        if (c) setLoading(false);
      }
    })();
    return () => {
      c = false;
    };
  }, [editId, navigate]);

  const validateSubmit = (asDraft: boolean) => {
    if (asDraft) {
      if (!fullName.trim() || !position.trim() || !department.trim()) {
        toast.error('Please fill in at least name, position, and department to save a draft.');
        return false;
      }
      return true;
    }
    if (!fullName.trim() || !position.trim() || !department.trim() || !dateOfSep) {
      toast.error('Please complete all required fields in Section I.');
      return false;
    }
    if (reasonCategory === 'other' && !reasonOtherDetails.trim()) {
      toast.error('Please describe the reason when you select “Others”.');
      return false;
    }
    return true;
  };

  const onSubmit = async (e: React.FormEvent, asDraft: boolean) => {
    e.preventDefault();
    if (!validateSubmit(asDraft)) return;
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      fullName: fullName.trim(),
      position: position.trim(),
      department: department.trim(),
      reason: reason.trim() || null,
      status: asDraft ? 'draft' : 'pending',
    };
    if (asDraft) {
      payload.employeeType = employeeType;
      if (dateOfSep) payload.dateOfSeparation = dateInputToIso(dateOfSep);
      payload.reasonCategory = reasonCategory;
      payload.reasonOtherDetails = reasonCategory === 'other' ? reasonOtherDetails.trim() || null : null;
    } else {
      payload.employeeType = employeeType;
      payload.dateOfSeparation = dateInputToIso(dateOfSep);
      payload.reasonCategory = reasonCategory;
      payload.reasonOtherDetails = reasonCategory === 'other' ? reasonOtherDetails.trim() || null : null;
    }
    try {
      if (editId) {
        const res = await fetch(`/api/institutional/clearances/${editId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: asDraft ? 'draft' : 'pending' }),
        });
        const j = await parseResponseJson(res);
        if (!res.ok) throw new Error(userErrorFromApi(j, 'Could not save your clearance. Try again.'));
        toast.success('Clearance updated.');
        navigate(`/dashboard/institutional/clearances/${editId}`, { replace: true });
        return;
      }
      const res = await fetch('/api/institutional/clearances', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await parseResponseJson(res);
      if (!res.ok) throw new Error(userErrorFromApi(j, 'Could not save your clearance. Try again.'));
      toast.success('Clearance created.');
      navigate(`/dashboard/institutional/clearances/${(j as { id: string }).id}`, { replace: true });
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not save your clearance. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (editId && loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="app-page flex w-full min-h-0 min-h-[calc(100dvh-5.5rem)] flex-1 flex-col bg-gradient-to-br from-slate-50/80 via-blue-50/20 to-transparent px-4 py-6 pb-12 dark:from-gray-950/50 dark:via-gray-900/30 sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:py-8 sm:pb-16 lg:px-8">
        <div className="mx-auto flex w-full min-w-0 flex-1 flex-col space-y-6">
          <Button
            type="button"
            variant="ghost"
            className="gap-1 -ml-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <InstitutionalPageBrand
            title={editId ? 'Edit my request' : 'New request'}
            subtitle="Fill out your details, then submit so offices can process your clearance in sequence."
          />
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex min-h-0 min-h-[min(58vh,32rem)] flex-1 flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:min-h-[min(70vh,52rem)] sm:gap-6 sm:p-8"
          >
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Section I: Personal information</CardTitle>
                <CardDescription>Employees only — not the student program.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="ic-name">Name *</Label>
                    <Input
                      id="ic-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ic-position">Position *</Label>
                    <Input
                      id="ic-position"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select value={employeeType} onValueChange={(v) => setEmployeeType(v as EmpType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYEE_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="ic-dept">Department / office *</Label>
                    <Input
                      id="ic-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2 sm:max-w-xs">
                    <Label htmlFor="ic-sep">Date of separation *</Label>
                    <Input
                      id="ic-sep"
                      type="date"
                      value={dateOfSep}
                      onChange={(e) => setDateOfSep(e.target.value)}
                      className="rounded-lg"
                    />
                    <p className="text-xs text-muted-foreground">Required when submitting (not for draft with defaults).</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Reason for clearance *</Label>
                    <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v as ReasonCat)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REASON_CATEGORY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {reasonCategory === 'other' && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="ic-other">Specify (required if Others)</Label>
                      <Textarea
                        id="ic-other"
                        value={reasonOtherDetails}
                        onChange={(e) => setReasonOtherDetails(e.target.value)}
                        className="min-h-[80px] rounded-lg"
                        placeholder="Describe the reason"
                      />
                    </div>
                  )}
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="ic-notes">Additional remarks (optional)</Label>
                    <Textarea
                      id="ic-notes"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="min-h-[5rem] resize-y rounded-lg"
                      placeholder="Any additional context (supporting details, references, etc.)"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed border-border/80 bg-muted/20">
              <CardContent className="flex gap-3 py-4 text-sm text-muted-foreground">
                <Info className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
                <div>
                  <p className="font-medium text-foreground">Sections II, III, and IV</p>
                  <p className="mt-1">
                    <strong>Section II</strong> will list the following offices in order:{' '}
                    {INSTITUTIONAL_CLEARANCE_OFFICE_ROWS.slice(0, 5).join(' · ')} and{' '}
                    {INSTITUTIONAL_CLEARANCE_OFFICE_ROWS.length - 5} more, each with remarks and signature
                    &amp; date.
                  </p>
                  <p className="mt-2">
                    <strong>Section III</strong> is certification (prepared, HRMDO verified, President approved).
                    <strong> Section IV</strong> is final clearance and remarks — completed by signatories / HR
                    as applicable.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="mt-auto flex flex-none flex-wrap gap-2 border-t border-border/60 pt-5">
              <Button
                type="button"
                disabled={submitting}
                variant="secondary"
                onClick={(e) => onSubmit(e, true)}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save draft'}
              </Button>
              <Button type="button" disabled={submitting} onClick={(e) => onSubmit(e, false)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
