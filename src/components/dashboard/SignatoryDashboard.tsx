import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock, CheckCircle, XCircle, FileText, Loader2, Paperclip, Filter, Search, ArrowUpDown, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import ClearanceFilesViewer from './ClearanceFilesViewer';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface PendingSignature {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  notes: string | null;
  remarks: string | null;
  sequence_order: number;
  created_at: string;
  clearance_request: {
    id: string;
    title: string;
    description: string | null;
    created_at: string;
    profiles: {
      full_name: string;
      student_id: string | null;
      course: string | null;
      year_level: string | null;
    };
  };
  canSign?: boolean; // computed field
}

interface AllSignature {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  sequence_order: number;
  clearance_request_id: string;
}

export default function SignatoryDashboard() {
  const { user } = useAuth();
  const [signatures, setSignatures] = useState<PendingSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignature, setSelectedSignature] = useState<PendingSignature | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [remarks, setRemarks] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [filesViewerOpen, setFilesViewerOpen] = useState(false);
  const [viewingSignature, setViewingSignature] = useState<PendingSignature | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'approve' | 'reject'>('approve');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    if (user) {
      fetchPendingSignatures();
    }
  }, [user]);

  const fetchPendingSignatures = async () => {
    try {
      // First get the signatory record for the current user
      const { data: signatoryData, error: signatoryError } = await supabase
        .from('signatories')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (signatoryError || !signatoryData) {
        setLoading(false);
        return;
      }

      // Then fetch all signatures for this signatory
      const { data, error } = await supabase
        .from('clearance_signatures')
        .select(`
          *,
          clearance_request:clearance_requests(
            id,
            title,
            description,
            created_at,
            profiles:student_id(
              full_name,
              student_id,
              course,
              year_level
            )
          )
        `)
        .eq('signatory_id', signatoryData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get all signatures for these clearance requests to check sequence
      const clearanceIds = [...new Set((data || []).map((s: any) => s.clearance_request?.id).filter(Boolean))];
      
      let allSignaturesMap: Record<string, AllSignature[]> = {};
      
      if (clearanceIds.length > 0) {
        const { data: allSigs } = await supabase
          .from('clearance_signatures')
          .select('id, status, sequence_order, clearance_request_id')
          .in('clearance_request_id', clearanceIds);
        
        // Group by clearance_request_id
        (allSigs || []).forEach((sig: AllSignature) => {
          if (!allSignaturesMap[sig.clearance_request_id]) {
            allSignaturesMap[sig.clearance_request_id] = [];
          }
          allSignaturesMap[sig.clearance_request_id].push(sig);
        });
      }

      // Compute canSign for each signature
      const processedSignatures = (data || []).map((sig: any) => {
        const clearanceId = sig.clearance_request?.id;
        const allSigsForRequest = allSignaturesMap[clearanceId] || [];
        
        // Check if all previous signatures (lower sequence_order) are approved
        const previousSigs = allSigsForRequest.filter(
          (s) => s.sequence_order < sig.sequence_order
        );
        const allPreviousApproved = previousSigs.every((s) => s.status === 'approved');
        
        return {
          ...sig,
          canSign: sig.status === 'pending' && allPreviousApproved,
        };
      });

      setSignatures(processedSignatures as PendingSignature[]);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      toast.error('Failed to load pending signatures');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (signature: PendingSignature, type: 'approve' | 'reject') => {
    setSelectedSignature(signature);
    setActionType(type);
    setNotes('');
    setRemarks('');
    setDialogOpen(true);
  };

  const handleViewFiles = (signature: PendingSignature) => {
    setViewingSignature(signature);
    setFilesViewerOpen(true);
  };

  const submitAction = async () => {
    if (!selectedSignature) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('clearance_signatures')
        .update({
          status: actionType === 'approve' ? 'approved' : 'rejected',
          notes: notes || null,
          remarks: remarks || null,
          signed_at: new Date().toISOString(),
        })
        .eq('id', selectedSignature.id);

      if (error) throw error;

      toast.success(`Clearance ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setDialogOpen(false);
      fetchPendingSignatures();
    } catch (error) {
      console.error('Error updating signature:', error);
      toast.error('Failed to update signature');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="pending">Pending</Badge>;
      case 'approved':
        return <Badge variant="approved">Approved</Badge>;
      case 'rejected':
        return <Badge variant="rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = signatures.filter((s) => s.status === 'pending').length;
  const approvedCount = signatures.filter((s) => s.status === 'approved').length;
  const rejectedCount = signatures.filter((s) => s.status === 'rejected').length;

  const filteredSignatures = signatures.filter((s) => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || 
      s.clearance_request.title.toLowerCase().includes(query) ||
      s.clearance_request.profiles.full_name.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  // Sort filtered signatures
  const sortedSignatures = [...filteredSignatures].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'name':
        comparison = a.clearance_request.profiles.full_name.localeCompare(b.clearance_request.profiles.full_name);
        break;
      case 'title':
        comparison = a.clearance_request.title.localeCompare(b.clearance_request.title);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedSignatures.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSignatures = sortedSignatures.slice(startIndex, endIndex);

  // Bulk action helpers (must be after paginatedSignatures is defined)
  // Only allow bulk actions on signatures that can sign (previous are approved)
  const signableSignaturesOnPage = paginatedSignatures.filter(s => s.status === 'pending' && s.canSign);
  const allSignableSelected = signableSignaturesOnPage.length > 0 && 
    signableSignaturesOnPage.every(s => selectedIds.has(s.id));
  const someSignableSelected = signableSignaturesOnPage.some(s => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allSignableSelected) {
      const newSelected = new Set(selectedIds);
      signableSignaturesOnPage.forEach(s => newSelected.delete(s.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      signableSignaturesOnPage.forEach(s => newSelected.add(s.id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = (type: 'approve' | 'reject') => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one request');
      return;
    }
    setBulkActionType(type);
    setBulkNotes('');
    setBulkDialogOpen(true);
  };

  const submitBulkAction = async () => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      const { error } = await supabase
        .from('clearance_signatures')
        .update({
          status: bulkActionType === 'approve' ? 'approved' : 'rejected',
          notes: bulkNotes || null,
          signed_at: new Date().toISOString(),
        })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} clearance(s) ${bulkActionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setBulkDialogOpen(false);
      setSelectedIds(new Set());
      fetchPendingSignatures();
    } catch (error) {
      console.error('Error updating signatures:', error);
      toast.error('Failed to update signatures');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortBy, sortOrder]);

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, 'ellipsis', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Signatory Dashboard</h1>
        <p className="text-muted-foreground mt-1">Review and approve clearance requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-3xl font-display font-bold mt-1">{pendingCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-warning/10 text-warning">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-display font-bold mt-1">{approvedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-success/10 text-success">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-3xl font-display font-bold mt-1">{rejectedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="font-display">Clearance Requests</CardTitle>
              <CardDescription>Review and process student clearance requests</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({signatures.length})</SelectItem>
                  <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
                  <SelectItem value="approved">Approved ({approvedCount})</SelectItem>
                  <SelectItem value="rejected">Rejected ({rejectedCount})</SelectItem>
                </SelectContent>
              </Select>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground ml-2" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Student Name</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest</SelectItem>
                  <SelectItem value="asc">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredSignatures.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                {signatures.length === 0 ? 'No requests assigned' : 'No matching requests'}
              </h3>
              <p className="text-muted-foreground mt-2">
                {signatures.length === 0 
                  ? "You don't have any clearance requests to review"
                  : `No ${statusFilter} requests found`}
              </p>
            </div>
          ) : (
            <>
              {/* Bulk Actions Bar */}
              {signableSignaturesOnPage.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={allSignableSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select all signable ({signableSignaturesOnPage.length})
                    </label>
                  </div>
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm text-muted-foreground">
                        {selectedIds.size} selected
                      </span>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleBulkAction('approve')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve Selected
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleBulkAction('reject')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject Selected
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-4">
                {paginatedSignatures.map((signature, index) => (
                  <div
                    key={signature.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors animate-slide-up gap-4 ${
                      signature.status === 'pending' && !signature.canSign ? 'opacity-60' : ''
                    }`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-start gap-4">
                      {signature.status === 'pending' && signature.canSign && (
                        <Checkbox
                          checked={selectedIds.has(signature.id)}
                          onCheckedChange={() => toggleSelectOne(signature.id)}
                          className="mt-1"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-bold">
                          {signature.sequence_order}
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold">{signature.clearance_request.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {signature.clearance_request.profiles.full_name}
                          {signature.clearance_request.profiles.student_id && (
                            <span className="ml-2">• {signature.clearance_request.profiles.student_id}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {signature.clearance_request.profiles.course} • {signature.clearance_request.profiles.year_level}
                        </p>
                        {signature.status === 'pending' && !signature.canSign && (
                          <p className="text-xs text-warning mt-1 flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Waiting for previous signatories to approve
                          </p>
                        )}
                        {signature.remarks && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Remarks: "{signature.remarks}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-12 sm:ml-0">
                      {getStatusBadge(signature.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewFiles(signature)}
                      >
                        <Paperclip className="h-4 w-4 mr-1" />
                        Files
                      </Button>
                      {signature.status === 'pending' && signature.canSign && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleAction(signature, 'approve')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleAction(signature, 'reject')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, sortedSignatures.length)} of {sortedSignatures.length} requests
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((page, idx) => (
                        <PaginationItem key={idx}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {actionType === 'approve' ? 'Approve' : 'Reject'} Clearance
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'Confirm approval of this clearance request.'
                : 'Provide a reason for rejecting this clearance request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder={
                  actionType === 'approve'
                    ? 'Add any notes for the student...'
                    : 'Explain why this clearance is being rejected...'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks (optional)</Label>
              <Textarea
                placeholder="Add any remarks that will be visible on the clearance..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Remarks will be displayed on the student's clearance record.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'approve' ? 'success' : 'destructive'}
              onClick={submitAction}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : actionType === 'approve' ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {bulkActionType === 'approve' ? 'Approve' : 'Reject'} {selectedIds.size} Clearance(s)
            </DialogTitle>
            <DialogDescription>
              {bulkActionType === 'approve'
                ? `Confirm approval of ${selectedIds.size} clearance request(s).`
                : `Provide a reason for rejecting ${selectedIds.size} clearance request(s).`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes (optional - applies to all selected)</Label>
              <Textarea
                placeholder={
                  bulkActionType === 'approve'
                    ? 'Add any notes for the students...'
                    : 'Explain why these clearances are being rejected...'
                }
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={bulkActionType === 'approve' ? 'success' : 'destructive'}
              onClick={submitBulkAction}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : bulkActionType === 'approve' ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {bulkActionType === 'approve' ? 'Approve All' : 'Reject All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Files Viewer Dialog */}
      {viewingSignature && (
        <ClearanceFilesViewer
          clearanceRequestId={viewingSignature.clearance_request.id}
          clearanceTitle={viewingSignature.clearance_request.title}
          studentName={viewingSignature.clearance_request.profiles.full_name}
          open={filesViewerOpen}
          onOpenChange={setFilesViewerOpen}
        />
      )}
    </div>
  );
}
