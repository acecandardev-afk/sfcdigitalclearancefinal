import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUserRole } from '@/hooks/useUserRole';
import {
  canCreateUsers,
  canArchiveSignatory,
  canManageArchivedRecords,
  canManageDefaultSignatories,
  canWriteSignatories,
} from '@/lib/permissionsMatrix';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Pencil,
  Archive,
  Trash2,
  Loader2,
  Users,
  Search,
  UserPlus,
  KeyRound,
  ListOrdered,
  ChevronUp,
  ChevronDown,
  UserPlus2,
  CheckCircle2,
  ArrowDown,
  GripVertical,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatApiErrorBody } from '@/lib/userMessages';
import { safeActionErrorMessage } from '@/lib/userFacingError';

interface Signatory {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
  /** Who may fill Section III lines on institutional clearance: preparer / HRMDO / President */
  institutional_cert_role: 'none' | 'preparer' | 'hrmdo' | 'president';
  /** Weekly office hours JSON (validated server-side when enforcing submit windows). */
  weekly_hours_json: unknown | null;
}

type RequirementEditorRow = {
  clientKey: string;
  sort_order: number;
  kind: 'document' | 'physical' | 'office';
  label: string;
  instructions: string;
  required: boolean;
};

function newClientKey() {
  return globalThis.crypto?.randomUUID?.() ?? `k-${Math.random().toString(36).slice(2)}`;
}

function requirementApiToEditor(r: Record<string, unknown>): RequirementEditorRow {
  const sort =
    typeof r.sortOrder === 'number'
      ? r.sortOrder
      : typeof r.sort_order === 'number'
        ? r.sort_order
        : 0;
  const k = String(r.kind ?? 'document');
  const kind: RequirementEditorRow['kind'] =
    k === 'physical' || k === 'office' ? k : 'document';
  return {
    clientKey: newClientKey(),
    sort_order: sort,
    kind,
    label: String(r.label ?? ''),
    instructions: r.instructions == null ? '' : String(r.instructions),
    required: r.required !== false,
  };
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
    institutional_cert_role:
      (s.institutionalCertRole as Signatory['institutional_cert_role'] | undefined) ??
      (s.institutional_cert_role as Signatory['institutional_cert_role'] | undefined) ??
      'none',
    weekly_hours_json: (s.weeklyHoursJson ?? s.weekly_hours_json ?? null) as unknown | null,
  };
}

const signatorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  position: z.string().trim().min(1, 'Position is required').max(100, 'Position must be less than 100 characters'),
  department: z.string().trim().min(1, 'Department is required').max(100, 'Department must be less than 100 characters'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
  institutional_cert_role: z.enum(['none', 'preparer', 'hrmdo', 'president']).default('none'),
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

type DefaultSignatoryOrderItem = {
  id: string;
  signatory_id: string;
  sequence_order: number;
  signatory: Signatory;
};

function SortableDefaultOrderRow({
  row,
  step,
  disabled,
  highlight,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  row: DefaultSignatoryOrderItem;
  step: number;
  disabled: boolean;
  highlight: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`default-order-row-${row.id}`}
      className={cn(
        'flex items-center justify-between gap-2 p-4 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border/80 transition-all duration-300',
        isDragging && 'opacity-60 shadow-md z-10',
        highlight &&
          'ring-2 ring-primary/70 shadow-lg bg-primary/[0.06] scale-[1.01] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          className={cn(
            'shrink-0 touch-none rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled && 'pointer-events-none opacity-50'
          )}
          disabled={disabled}
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="flex items-center justify-center h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground text-sm font-bold">
          {step}
        </span>
        <div className="min-w-0">
          <p className="font-medium truncate">{row.signatory.name}</p>
          <p className="text-sm text-muted-foreground truncate">
            {row.signatory.position} • {row.signatory.department}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isFirst}
          onClick={onMoveUp}
          aria-label="Move up one step"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isLast}
          onClick={onMoveDown}
          aria-label="Move down one step"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
          aria-label="Remove from default order"
          title="Remove from default order"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Signatories() {
  const navigate = useNavigate();
  const { roles, loading: roleLoading } = useUserRole();
  const allowSignatoryPage = useMemo(() => canWriteSignatories(roles), [roles]);
  const allowArchiveSig = useMemo(() => canArchiveSignatory(roles), [roles]);
  const allowArchivedPage = useMemo(() => canManageArchivedRecords(roles), [roles]);
  const allowCreateUser = useMemo(() => canCreateUsers(roles), [roles]);
  const allowDefaultOrder = useMemo(() => canManageDefaultSignatories(roles), [roles]);

  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [removeOrderRowId, setRemoveOrderRowId] = useState<string | null>(null);
  const [requirementsDialogOpen, setRequirementsDialogOpen] = useState(false);
  const [reqSignatory, setReqSignatory] = useState<Signatory | null>(null);
  const [reqEditorRows, setReqEditorRows] = useState<RequirementEditorRow[]>([]);
  const [weeklyHoursDraft, setWeeklyHoursDraft] = useState('');
  const [reqRowsLoading, setReqRowsLoading] = useState(false);
  const [reqSaving, setReqSaving] = useState(false);
  const [selectedSignatory, setSelectedSignatory] = useState<Signatory | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  // Default signatories for student clearances (admin-assigned order)
  const [defaultSignatories, setDefaultSignatories] = useState<DefaultSignatoryOrderItem[]>([]);
  const [defaultOrderLoading, setDefaultOrderLoading] = useState(false);
  const [addDefaultDialogOpen, setAddDefaultDialogOpen] = useState(false);
  const [addOrderSearch, setAddOrderSearch] = useState('');
  const [insertAsFirst, setInsertAsFirst] = useState(false);
  const [highlightDefaultRowId, setHighlightDefaultRowId] = useState<string | null>(null);

  const reorderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const signatoryForm = useForm<SignatoryFormData>({
    resolver: zodResolver(signatorySchema),
    defaultValues: {
      name: '',
      position: '',
      department: '',
      email: '',
      institutional_cert_role: 'none',
    },
  });

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!roleLoading) {
      if (!allowSignatoryPage) {
        navigate('/dashboard');
      } else {
        fetchSignatories();
        fetchDefaultSignatories();
      }
    }
  }, [roleLoading, allowSignatoryPage, navigate]);

  const fetchDefaultSignatories = async () => {
    try {
      const res = await fetch('/api/default-signatories', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      setDefaultSignatories((json.defaultSignatories || []) as DefaultSignatoryOrderItem[]);
    } catch (error) {
      console.error('Error fetching default signatories:', error);
      toast.error(safeActionErrorMessage(error, 'Could not load the default signatory list. Try refreshing the page.'));
    }
  };

  const fetchSignatories = async () => {
    try {
      const res = await fetch('/api/signatories', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      setSignatories(((json.signatories || []) as any[]).map(apiSignatoryToUi));
    } catch (error) {
      console.error('Error fetching signatories:', error);
      toast.error(safeActionErrorMessage(error, 'Could not load signatories. Try refreshing the page.'));
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
      institutional_cert_role: 'none',
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
      institutional_cert_role: signatory.institutional_cert_role,
    });
    setDialogOpen(true);
  };

  const openArchiveDialog = (signatory: Signatory) => {
    setSelectedSignatory(signatory);
    setArchiveDialogOpen(true);
  };

  const openAccountDialog = (signatory: Signatory) => {
    setSelectedSignatory(signatory);
    accountForm.reset({ password: '', confirmPassword: '' });
    setAccountDialogOpen(true);
  };

  const openRequirementsDialog = (signatory: Signatory) => {
    setReqSignatory(signatory);
    setWeeklyHoursDraft(
      signatory.weekly_hours_json != null ? JSON.stringify(signatory.weekly_hours_json, null, 2) : ''
    );
    setReqEditorRows([]);
    setRequirementsDialogOpen(true);
    void loadRequirementsFor(signatory.id);
  };

  const loadRequirementsFor = async (signatoryId: string) => {
    setReqRowsLoading(true);
    try {
      const res = await fetch(`/api/signatories/${signatoryId}/requirements`, { credentials: 'include' });
      const json = (await res.json().catch(() => ({}))) as { requirements?: Record<string, unknown>[] };
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      const list = json.requirements ?? [];
      setReqEditorRows(list.map(requirementApiToEditor));
    } catch (e) {
      console.error(e);
      toast.error(safeActionErrorMessage(e, 'Could not load requirements. Try again.'));
    } finally {
      setReqRowsLoading(false);
    }
  };

  const saveRequirementsAndHours = async () => {
    if (!reqSignatory) return;
    let weeklyParsed: unknown | null = null;
    if (weeklyHoursDraft.trim()) {
      try {
        weeklyParsed = JSON.parse(weeklyHoursDraft) as unknown;
      } catch {
        toast.error('Office hours could not be saved. Check the day and time entries.');
        return;
      }
    } else {
      weeklyParsed = null;
    }

    setReqSaving(true);
    try {
      const putBody = {
        requirements: reqEditorRows.map((row, idx) => ({
          sort_order: Number.isFinite(row.sort_order) ? row.sort_order : idx,
          kind: row.kind,
          label: row.label.trim(),
          instructions: row.instructions.trim() || null,
          required: row.required,
        })),
      };
      const resPut = await fetch(`/api/signatories/${reqSignatory.id}/requirements`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });
      const jsonPut = await resPut.json().catch(() => ({}));
      if (!resPut.ok) throw new Error(formatApiErrorBody(jsonPut));

      const resPatch = await fetch(`/api/signatories/${reqSignatory.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_hours_json: weeklyParsed }),
      });
      const jsonPatch = await resPatch.json().catch(() => ({}));
      if (!resPatch.ok) throw new Error(formatApiErrorBody(jsonPatch));

      toast.success('Requirements and office hours saved');
      setRequirementsDialogOpen(false);
      setReqSignatory(null);
      await fetchSignatories();
    } catch (e) {
      console.error(e);
      toast.error(safeActionErrorMessage(e, 'Could not save. Check your entries and try again.'));
    } finally {
      setReqSaving(false);
    }
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
            institutional_cert_role: data.institutional_cert_role,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(formatApiErrorBody(json));
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
            institutional_cert_role: data.institutional_cert_role,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(formatApiErrorBody(json));
        toast.success('Signatory added successfully');
      }

      setDialogOpen(false);
      fetchSignatories();
    } catch (error) {
      console.error('Error saving signatory:', error);
      toast.error(safeActionErrorMessage(error, 'Could not save signatory. Try again.'));
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
      if (!res.ok) throw new Error(formatApiErrorBody(json));

      toast.success('Account created successfully! The signatory can now login.');
      setAccountDialogOpen(false);
      fetchSignatories();
    } catch (error: unknown) {
      console.error('Error creating account:', error);
      toast.error(safeActionErrorMessage(error, 'Could not create that account. Try again.'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedSignatory) return;

    try {
      const res = await fetch(`/api/signatories/${selectedSignatory.id}/archive`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      toast.success('Signatory archived');
      setArchiveDialogOpen(false);
      fetchSignatories();
    } catch (error) {
      console.error('Error archiving signatory:', error);
      toast.error(safeActionErrorMessage(error, 'Could not archive this signatory. Try again.'));
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
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      toast.success(`Signatory ${signatory.is_active ? 'deactivated' : 'activated'}`);
      fetchSignatories();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error(safeActionErrorMessage(error, 'Could not update status. Try again.'));
    }
  };

  const stepBySignatoryId = useMemo(() => {
    const m = new Map<string, number>();
    defaultSignatories.forEach((d, i) => m.set(d.signatory_id, i + 1));
    return m;
  }, [defaultSignatories]);

  const pickerSignatories = useMemo(() => {
    const q = addOrderSearch.trim().toLowerCase();
    const list = [...signatories].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.position.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [signatories, addOrderSearch]);

  const canAddAnyActive = useMemo(
    () => signatories.some((s) => s.is_active && !stepBySignatoryId.has(s.id)),
    [signatories, stepBySignatoryId]
  );

  useEffect(() => {
    if (!highlightDefaultRowId) return;
    const t = window.setTimeout(() => setHighlightDefaultRowId(null), 3200);
    const el = document.getElementById(`default-order-row-${highlightDefaultRowId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return () => window.clearTimeout(t);
  }, [highlightDefaultRowId]);

  const addToDefaultOrder = async (signatory: Signatory) => {
    if (!allowDefaultOrder) return;
    if (!signatory.is_active || stepBySignatoryId.has(signatory.id)) return;
    setDefaultOrderLoading(true);
    try {
      const body: { signatory_id: string; insert_at?: number } = { signatory_id: signatory.id };
      if (insertAsFirst) body.insert_at = 1;
      const res = await fetch('/api/default-signatories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; sequence_order?: number; error?: unknown };
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      toast.success(
        insertAsFirst
          ? `${signatory.name} added as step 1 (others shifted down)`
          : `${signatory.name} added as step ${json.sequence_order ?? '?'}`,
        { duration: 2500 }
      );
      if (json.id) setHighlightDefaultRowId(json.id);
      if (insertAsFirst) setInsertAsFirst(false);
      await fetchDefaultSignatories();
    } catch (error) {
      console.error('Error adding to default order:', error);
      toast.error(safeActionErrorMessage(error, 'Could not add to the default order. Try again.'));
    } finally {
      setDefaultOrderLoading(false);
    }
  };

  const removeFromDefaultOrder = (rowId: string) => {
    if (!allowDefaultOrder) return;
    setRemoveOrderRowId(rowId);
  };

  const confirmRemoveFromOrder = async () => {
    if (!removeOrderRowId) return;
    const rowId = removeOrderRowId;
    setRemoveOrderRowId(null);
    setDefaultOrderLoading(true);
    try {
      const res = await fetch(`/api/default-signatories/${rowId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      toast.success('Removed from default order');
      fetchDefaultSignatories();
    } catch (error) {
      console.error('Error removing from default order:', error);
      toast.error(safeActionErrorMessage(error, 'Could not remove from the default order. Try again.'));
    } finally {
      setDefaultOrderLoading(false);
    }
  };

  const commitDefaultOrderReorder = async (ids: string[]) => {
    if (!allowDefaultOrder) return;
    setDefaultOrderLoading(true);
    try {
      const res = await fetch('/api/default-signatories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      setDefaultSignatories((json.defaultSignatories || []) as DefaultSignatoryOrderItem[]);
      toast.success('Order updated');
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error(safeActionErrorMessage(error, 'Could not update the order. Try again.'));
      await fetchDefaultSignatories();
    } finally {
      setDefaultOrderLoading(false);
    }
  };

  const moveInDefaultOrder = (index: number, direction: 'up' | 'down') => {
    if (!allowDefaultOrder || defaultOrderLoading) return;
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= defaultSignatories.length) return;
    const newIds = arrayMove(defaultSignatories, index, swap).map((d) => d.id);
    void commitDefaultOrderReorder(newIds);
  };

  const onDefaultOrderDragEnd = (event: DragEndEvent) => {
    if (!allowDefaultOrder || defaultOrderLoading) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = defaultSignatories.findIndex((d) => d.id === active.id);
    const newIndex = defaultSignatories.findIndex((d) => d.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newIds = arrayMove(defaultSignatories, oldIndex, newIndex).map((d) => d.id);
    void commitDefaultOrderReorder(newIds);
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
      <div className="w-full min-w-0 p-6 lg:p-8 xl:px-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight">Manage Signatories</h1>
            <p className="text-muted-foreground mt-1">Add, edit, or archive signatories. Assign who signs student requests.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {allowArchivedPage ? (
              <Button variant="outline" asChild className="rounded-xl shadow-sm">
                <Link to="/dashboard/archived">View archived</Link>
              </Button>
            ) : null}
            <Button onClick={openAddDialog} className="rounded-xl shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Signatory
            </Button>
          </div>
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
              Students cannot choose signatories. Set the signatories and order for every new request. Drag the grip
              handle to reorder steps, or use the arrows to move one step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {defaultSignatories.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border/70 rounded-xl bg-muted/20">
                <p className="text-muted-foreground">No default signatories set.</p>
                <p className="text-sm text-muted-foreground mt-1">Add signatories below; they will sign in the order you set.</p>
              </div>
            ) : (
              <DndContext
                sensors={reorderSensors}
                collisionDetection={closestCenter}
                onDragEnd={onDefaultOrderDragEnd}
              >
                <SortableContext
                  items={defaultSignatories.map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {defaultSignatories.map((d, index) => (
                      <SortableDefaultOrderRow
                        key={d.id}
                        row={d}
                        step={index + 1}
                        disabled={defaultOrderLoading || !allowDefaultOrder}
                        highlight={highlightDefaultRowId === d.id}
                        isFirst={index === 0}
                        isLast={index === defaultSignatories.length - 1}
                        onMoveUp={() => moveInDefaultOrder(index, 'up')}
                        onMoveDown={() => moveInDefaultOrder(index, 'down')}
                        onRemove={() => removeFromDefaultOrder(d.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={defaultOrderLoading || !allowDefaultOrder || !canAddAnyActive}
              onClick={() => {
                setAddOrderSearch('');
                setInsertAsFirst(false);
                setAddDefaultDialogOpen(true);
              }}
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
                      {!signatory.user_id && allowCreateUser && (
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
                        onClick={() => openRequirementsDialog(signatory)}
                        className="rounded-xl"
                      >
                        <ListChecks className="h-4 w-4 mr-1" />
                        Requirements
                      </Button>
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
                      {allowArchiveSig && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                          onClick={() => openArchiveDialog(signatory)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
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
              <FormField
                control={signatoryForm.control}
                name="institutional_cert_role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institutional clearance (Section III)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Not used for Section III</SelectItem>
                        <SelectItem value="preparer">Prepared by (employee)</SelectItem>
                        <SelectItem value="hrmdo">Checked and verified (HRMDO)</SelectItem>
                        <SelectItem value="president">Approved (College President)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Limits who can edit each certification line on employee institutional clearances.
                    </p>
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

      <Dialog
        open={requirementsDialogOpen}
        onOpenChange={(open) => {
          setRequirementsDialogOpen(open);
          if (!open) setReqSignatory(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Requirements &amp; office hours</DialogTitle>
            <DialogDescription>
              {reqSignatory ? (
                <>
                  Configure submission methods for <strong>{reqSignatory.name}</strong>. Document = file upload; Physical =
                  student attestation; Office = verified by this office before signing.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {reqRowsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Requirements</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    setReqEditorRows((prev) => [
                      ...prev,
                      {
                        clientKey: newClientKey(),
                        sort_order: prev.length,
                        kind: 'document',
                        label: '',
                        instructions: '',
                        required: true,
                      },
                    ])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add row
                </Button>
              </div>
              <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                {reqEditorRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No requirements yet. Add rows or save empty to clear.</p>
                ) : (
                  reqEditorRows.map((row) => (
                    <div key={row.clientKey} className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex flex-wrap gap-2">
                        <div className="w-[100px]">
                          <Label className="text-xs">Sort</Label>
                          <Input
                            type="number"
                            value={row.sort_order}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setReqEditorRows((prev) =>
                                prev.map((x) =>
                                  x.clientKey === row.clientKey
                                    ? { ...x, sort_order: Number.isFinite(v) ? v : 0 }
                                    : x
                                )
                              );
                            }}
                          />
                        </div>
                        <div className="min-w-[140px] flex-1">
                          <Label className="text-xs">Kind</Label>
                          <Select
                            value={row.kind}
                            onValueChange={(v) =>
                              setReqEditorRows((prev) =>
                                prev.map((x) =>
                                  x.clientKey === row.clientKey
                                    ? { ...x, kind: v as RequirementEditorRow['kind'] }
                                    : x
                                )
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="document">document</SelectItem>
                              <SelectItem value="physical">physical</SelectItem>
                              <SelectItem value="office">office</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex cursor-pointer items-center gap-2 text-xs">
                            <Checkbox
                              checked={row.required}
                              onCheckedChange={(c) =>
                                setReqEditorRows((prev) =>
                                  prev.map((x) =>
                                    x.clientKey === row.clientKey ? { ...x, required: !!c } : x
                                  )
                                )
                              }
                            />
                            Required
                          </label>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={row.label}
                          onChange={(e) =>
                            setReqEditorRows((prev) =>
                              prev.map((x) =>
                                x.clientKey === row.clientKey ? { ...x, label: e.target.value } : x
                              )
                            )
                          }
                          placeholder="e.g. Medical certificate"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Instructions</Label>
                        <Textarea
                          rows={2}
                          value={row.instructions}
                          onChange={(e) =>
                            setReqEditorRows((prev) =>
                              prev.map((x) =>
                                x.clientKey === row.clientKey ? { ...x, instructions: e.target.value } : x
                              )
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          setReqEditorRows((prev) => prev.filter((x) => x.clientKey !== row.clientKey))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div>
                <Label>Weekly office hours (JSON)</Label>
                <p className="mb-1 text-[11px] text-muted-foreground">
                  Leave blank for no enforcement. Structure must match what the server expects for schedule checks.
                </p>
                <Textarea
                  rows={6}
                  className="font-mono text-xs"
                  value={weeklyHoursDraft}
                  onChange={(e) => setWeeklyHoursDraft(e.target.value)}
                  placeholder="{}"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setRequirementsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={reqSaving || reqRowsLoading || !reqSignatory}
              onClick={() => void saveRequirementsAndHours()}
            >
              {reqSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
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
                      <PasswordInput placeholder="••••••••" {...field} />
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
                      <PasswordInput placeholder="••••••••" {...field} />
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
      <Dialog
        open={addDefaultDialogOpen}
        onOpenChange={(open) => {
          setAddDefaultDialogOpen(open);
          if (!open) setAddOrderSearch('');
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg gap-0 p-0 overflow-hidden">
          <div className="p-6 pb-4 border-b border-border/60 bg-muted/20">
            <DialogHeader>
              <DialogTitle>Add signatory to request order</DialogTitle>
              <DialogDescription>
                All signatories are listed. <strong>Active</strong> people not yet in the sequence can be added. Each add
                goes to the <strong>next step</strong> (1, then 2, then 3…). Use &quot;Insert as step 1&quot; to place the
                next add at the front and shift others down.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, office, email…"
                  value={addOrderSearch}
                  onChange={(e) => setAddOrderSearch(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <Checkbox
                  checked={insertAsFirst}
                  onCheckedChange={(c) => setInsertAsFirst(!!c)}
                  id="insert-first"
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="insert-first" className="text-sm font-medium cursor-pointer">
                    Insert as step 1 (shift current sequence down)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Next click adds at the top; leave off to append after the last step.
                  </p>
                </div>
              </label>
            </div>
          </div>
          <div className="max-h-[min(52vh,420px)] overflow-y-auto p-3 space-y-1.5">
            {pickerSignatories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No signatories match your search.</p>
            ) : (
              pickerSignatories.map((sig, idx) => {
                const step = stepBySignatoryId.get(sig.id);
                const inOrder = step != null;
                const canClick = sig.is_active && !inOrder;
                return (
                  <button
                    key={sig.id}
                    type="button"
                    disabled={!canClick || defaultOrderLoading}
                    style={{ animationDelay: `${Math.min(idx, 20) * 25}ms` }}
                    className={cn(
                      'w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
                      canClick &&
                        'border-border/60 bg-card hover:bg-primary/[0.07] hover:border-primary/40 cursor-pointer active:scale-[0.99] shadow-sm',
                      !canClick && 'border-transparent bg-muted/30 opacity-90 cursor-not-allowed',
                      inOrder && 'ring-1 ring-muted'
                    )}
                    onClick={() => canClick && addToDefaultOrder(sig)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{sig.name}</p>
                        {!sig.is_active && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Inactive
                          </span>
                        )}
                        {inOrder && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            Step {step}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {sig.position} • {sig.department}
                      </p>
                    </div>
                    {canClick ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <ArrowDown className="h-3.5 w-3.5" />
                        {insertAsFirst ? 'Add as #1' : 'Add next'}
                      </span>
                    ) : inOrder ? (
                      <span className="text-xs text-muted-foreground shrink-0">In sequence</span>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">Activate first</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="p-4 border-t border-border/60 flex justify-end bg-muted/10">
            <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setAddDefaultDialogOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Signatory Confirmation */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive signatory?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{selectedSignatory?.name}</strong>? They will be hidden from the
              active list and cannot sign in until restored from the Archived page. Clearance history and office links
              are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove from Default Order Confirmation */}
      <AlertDialog open={!!removeOrderRowId} onOpenChange={(open) => { if (!open) setRemoveOrderRowId(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from default order?</AlertDialogTitle>
            <AlertDialogDescription>
              This signatory will no longer be automatically assigned to new student clearance requests. At least one
              signatory must remain in the order, and none may have pending clearance steps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmRemoveFromOrder()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
