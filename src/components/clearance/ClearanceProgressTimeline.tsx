import { CheckCircle, Clock, XCircle, User } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SignatureStep {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  sequence_order: number;
  signatory: {
    name: string;
    department: string;
  };
}

interface ClearanceProgressTimelineProps {
  signatures: SignatureStep[];
  compact?: boolean;
}

export default function ClearanceProgressTimeline({
  signatures,
  compact = false,
}: ClearanceProgressTimelineProps) {
  const approvedCount = signatures.filter((s) => s.status === 'approved').length;
  const totalCount = signatures.length;
  const progressPercent = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;
  const hasRejection = signatures.some((s) => s.status === 'rejected');

  const getStepStatus = (sig: SignatureStep, index: number) => {
    // Check if previous steps are all approved
    const previousApproved = signatures
      .filter((s) => s.sequence_order < sig.sequence_order)
      .every((s) => s.status === 'approved');
    
    if (sig.status === 'approved') return 'completed';
    if (sig.status === 'rejected') return 'rejected';
    if (sig.status === 'pending' && previousApproved) return 'current';
    return 'waiting';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'current':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className={cn(
            "font-medium",
            hasRejection ? "text-destructive" : approvedCount === totalCount ? "text-success" : "text-foreground"
          )}>
            {approvedCount}/{totalCount} signed
          </span>
        </div>
        <Progress 
          value={progressPercent} 
          className={cn(
            "h-2",
            hasRejection && "[&>div]:bg-destructive"
          )} 
        />
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {signatures.map((sig, index) => {
            const status = getStepStatus(sig, index);
            return (
              <div
                key={sig.id}
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium shrink-0 transition-all",
                  status === 'completed' && "bg-success text-success-foreground",
                  status === 'rejected' && "bg-destructive text-destructive-foreground",
                  status === 'current' && "bg-warning text-warning-foreground ring-2 ring-warning/30",
                  status === 'waiting' && "bg-muted text-muted-foreground"
                )}
                title={`${sig.signatory.name} - ${sig.signatory.department}`}
              >
                {sig.sequence_order}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall Progress</span>
          <span className={cn(
            "font-semibold",
            hasRejection ? "text-destructive" : approvedCount === totalCount ? "text-success" : "text-foreground"
          )}>
            {approvedCount}/{totalCount} signatures
          </span>
        </div>
        <Progress 
          value={progressPercent} 
          className={cn(
            "h-3",
            hasRejection && "[&>div]:bg-destructive"
          )} 
        />
      </div>

      {/* Timeline steps */}
      <div className="relative">
        {/* Connection line */}
        <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-border" />
        
        <div className="space-y-3">
          {signatures.map((sig, index) => {
            const status = getStepStatus(sig, index);
            return (
              <div
                key={sig.id}
                className={cn(
                  "relative flex items-center gap-3 p-3 rounded-lg border transition-all",
                  status === 'completed' && "bg-success/5 border-success/30",
                  status === 'rejected' && "bg-destructive/5 border-destructive/30",
                  status === 'current' && "bg-warning/5 border-warning/30 ring-1 ring-warning/20",
                  status === 'waiting' && "bg-muted/30 border-border opacity-60"
                )}
              >
                {/* Step number */}
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold shrink-0",
                    status === 'completed' && "bg-success text-success-foreground",
                    status === 'rejected' && "bg-destructive text-destructive-foreground",
                    status === 'current' && "bg-warning text-warning-foreground",
                    status === 'waiting' && "bg-muted text-muted-foreground"
                  )}
                >
                  {sig.sequence_order}
                </div>

                {/* Signatory info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{sig.signatory.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{sig.signatory.department}</p>
                </div>

                {/* Status icon */}
                <div className="shrink-0">
                  {getStepIcon(status)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
