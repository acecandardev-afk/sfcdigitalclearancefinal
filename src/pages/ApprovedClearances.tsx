import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { CheckCircle, FileText, Loader2, Search, ArrowUpDown, Eye } from 'lucide-react';
import { TERMS } from '@/lib/terms';
import { toast } from 'sonner';

interface ApprovedSignature {
  id: string;
  status: 'approved' | 'rejected';
  remarks: string | null;
  signed_at: string;
  clearance_request: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    profiles: {
      full_name: string;
      student_id: string | null;
      course: string | null;
      year_level: string | null;
    };
  };
}

export default function ApprovedClearances() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [signatures, setSignatures] = useState<ApprovedSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (user) {
      fetchApprovedSignatures();
    }
  }, [user]);

  const fetchApprovedSignatures = async () => {
    try {
      const res = await fetch('/api/signatory/history', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load processed requests');
      const json = await res.json();
      setSignatures((json.signatures || []) as ApprovedSignature[]);
    } catch (error) {
      console.error('Error fetching approved signatures:', error);
      toast.error('Failed to load processed requests');
    } finally {
      setLoading(false);
    }
  };

  const filteredSignatures = signatures.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      !query ||
      s.clearance_request.title.toLowerCase().includes(query) ||
      s.clearance_request.profiles.full_name.toLowerCase().includes(query)
    );
  });

  const sortedSignatures = [...filteredSignatures].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'date':
        comparison =
          new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime();
        break;
      case 'name':
        comparison = a.clearance_request.profiles.full_name.localeCompare(
          b.clearance_request.profiles.full_name
        );
        break;
      case 'title':
        comparison = a.clearance_request.title.localeCompare(
          b.clearance_request.title
        );
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedSignatures.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSignatures = sortedSignatures.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortOrder]);

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

  const approvedCount = signatures.filter((s) => s.status === 'approved').length;
  const rejectedCount = signatures.filter((s) => s.status === 'rejected').length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Completed</h1>
          <p className="text-muted-foreground mt-1">
            View all requests you have processed
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{TERMS.APPROVED}</p>
                  <p className="text-3xl font-display font-bold mt-1">
                    {approvedCount}
                  </p>
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
                  <p className="text-sm text-muted-foreground">{TERMS.REJECTED}</p>
                  <p className="text-3xl font-display font-bold mt-1">
                    {rejectedCount}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="font-display">Processing History</CardTitle>
                <CardDescription>
                  All requests you have approved or rejected
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as typeof sortBy)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="name">Student Name</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sortOrder}
                  onValueChange={(v) => setSortOrder(v as typeof sortOrder)}
                >
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
            ) : sortedSignatures.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">
                  {signatures.length === 0
                    ? 'No processed requests'
                    : 'No matching requests'}
                </h3>
                <p className="text-muted-foreground mt-2">
                  {signatures.length === 0
                    ? "You haven't approved or rejected any requests yet"
                    : 'Try adjusting your search'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedSignatures.map((signature, index) => (
                    <div
                      key={signature.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors animate-slide-up gap-4"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">
                            {signature.clearance_request.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {signature.clearance_request.profiles.full_name}
                            {signature.clearance_request.profiles.student_id && (
                              <span className="ml-2">
                                • {signature.clearance_request.profiles.student_id}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Signed on{' '}
                            {new Date(signature.signed_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          {signature.remarks && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Remarks: "{signature.remarks}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-12 sm:ml-0">
                        <Badge
                          variant={
                            signature.status === 'approved' ? 'approved' : 'rejected'
                          }
                        >
                          {signature.status === 'approved' ? TERMS.APPROVED : TERMS.REJECTED}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/dashboard/requests/${signature.clearance_request.id}`
                            )
                          }
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-
                      {Math.min(startIndex + itemsPerPage, sortedSignatures.length)} of{' '}
                      {sortedSignatures.length} requests
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className={
                              currentPage === 1
                                ? 'pointer-events-none opacity-50'
                                : 'cursor-pointer'
                            }
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
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            className={
                              currentPage === totalPages
                                ? 'pointer-events-none opacity-50'
                                : 'cursor-pointer'
                            }
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
      </div>
    </DashboardLayout>
  );
}
