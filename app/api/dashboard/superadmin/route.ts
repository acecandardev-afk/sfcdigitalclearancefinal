import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [studentRoles, activeSignatoriesCount, clearances, signatures] = await Promise.all([
    prisma.userRole.findMany({ where: { role: 'student' as any }, select: { userId: true } }),
    prisma.signatory.count({ where: { isActive: true } }),
    prisma.clearanceRequest.findMany({
      select: { id: true, status: true, studentId: true, createdAt: true, updatedAt: true, title: true },
    }),
    prisma.clearanceSignature.findMany({
      select: { clearanceRequestId: true, status: true },
    }),
  ]);

  const studentIds = new Set(studentRoles.map((r) => String(r.userId)));

  const pendingCount = clearances.filter((c) => c.status === 'pending').length;
  const approvedCount = clearances.filter((c) => c.status === 'approved').length;
  const rejectedCount = clearances.filter((c) => c.status === 'rejected').length;
  const inProgressCount = clearances.filter((c) => c.status === 'in_progress').length;

  const studentsWithApproved = new Set(
    clearances
      .filter((c) => c.status === 'approved')
      .map((c) => String(c.studentId))
  );

  const sigsByRequest = new Map<string, { approved: number; total: number }>();
  for (const s of signatures) {
    const key = s.clearanceRequestId;
    if (!sigsByRequest.has(key)) sigsByRequest.set(key, { approved: 0, total: 0 });
    const v = sigsByRequest.get(key)!;
    v.total++;
    if (s.status === 'approved') v.approved++;
  }

  const latestActiveByStudent = new Map<string, { id: string; createdAt: Date }>();
  for (const cr of clearances) {
    if (cr.status !== 'pending' && cr.status !== 'in_progress') continue;
    const sid = String(cr.studentId);
    const prev = latestActiveByStudent.get(sid);
    if (!prev || cr.createdAt > prev.createdAt) {
      latestActiveByStudent.set(sid, { id: cr.id, createdAt: cr.createdAt });
    }
  }

  let studentsNotSubmitted = 0;
  let studentsNearComplete = 0;
  let studentsWithActiveSubmissions = 0;

  for (const sid of studentIds) {
    if (studentsWithApproved.has(sid)) continue;
    const active = latestActiveByStudent.get(sid);
    const sigs = active ? sigsByRequest.get(active.id) : undefined;
    const total = sigs?.total ?? 0;
    const approved = sigs?.approved ?? 0;

    if (!active || total === 0) {
      studentsNotSubmitted++;
      continue;
    }

    studentsWithActiveSubmissions++;
    const ratio = total > 0 ? approved / total : 0;
    if (ratio >= 0.9 && approved < total) {
      studentsNearComplete++;
    }
  }

  const studentsInProgress = Math.max(0, studentsWithActiveSubmissions - studentsNearComplete);

  const totalStudents = studentIds.size;
  const studentsFullySigned = studentsWithApproved.size;
  const studentsLacking = Math.max(0, totalStudents - studentsFullySigned);

  // recent activity
  const recent = await prisma.clearanceRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      student: { select: { profile: { select: { fullName: true } } } },
    },
  });

  const recentActivity = recent.map((c) => ({
    id: c.id,
    type: 'clearance' as const,
    title: c.title,
    description: `by ${c.student.profile?.fullName || 'Unknown'}`,
    created_at: c.createdAt.toISOString(),
    status: c.status,
  }));

  // progression data (30 days)
  const days = 30;
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const progressionData: Array<{
    date: string;
    submissions: number;
    approvals: number;
    pending: number;
    in_progress: number;
    approved: number;
    rejected: number;
  }> = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = ymd(d);

    const dayClearances = clearances.filter((c) => ymd(c.createdAt) === dateStr);
    const submissions = dayClearances.length;

    const approvals = clearances.filter((c) => c.status === 'approved' && ymd(c.updatedAt) === dateStr).length;

    const pending = dayClearances.filter((c) => c.status === 'pending').length;
    const in_progress = dayClearances.filter((c) => c.status === 'in_progress').length;
    const approved = dayClearances.filter((c) => c.status === 'approved').length;
    const rejected = dayClearances.filter((c) => c.status === 'rejected').length;

    progressionData.push({
      date: dateStr,
      submissions,
      approvals,
      pending,
      in_progress,
      approved,
      rejected,
    });
  }

  return NextResponse.json({
    stats: {
      totalStudents,
      totalSignatories: activeSignatoriesCount,
      totalClearances: clearances.length,
      pendingClearances: pendingCount,
      approvedClearances: approvedCount,
      rejectedClearances: rejectedCount,
      inProgressClearances: inProgressCount,
      studentsLacking,
      studentsFullySigned,
      studentsNotSubmitted,
      studentsInProgress,
      studentsNearComplete,
    },
    statusBreakdown: [
      { name: 'Approved', value: approvedCount, color: '#10b981' },
      { name: 'In Progress', value: inProgressCount, color: '#3b82f6' },
      { name: 'Pending', value: pendingCount, color: '#f59e0b' },
      { name: 'Rejected', value: rejectedCount, color: '#ef4444' },
    ].filter((d) => d.value > 0),
    studentProgressBreakdown: [
      {
        name: 'Completed',
        value: studentsFullySigned,
        color: '#10b981',
        description: 'Fully approved clearance request',
      },
      {
        name: 'Not started',
        value: studentsNotSubmitted,
        color: '#94a3b8',
        description: 'No office submissions on an active request yet',
      },
      {
        name: 'In progress',
        value: studentsInProgress,
        color: '#f59e0b',
        description: 'Submitted to offices; still waiting on approvals',
      },
      {
        name: 'Almost done',
        value: studentsNearComplete,
        color: '#3b82f6',
        description: '90%+ of submitted offices approved',
      },
    ].filter((d) => d.value > 0),
    recentActivity,
    progressionData,
  });
}
