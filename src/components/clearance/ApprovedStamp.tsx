import { cn } from '@/lib/utils';

interface ApprovedStampProps {
  signedAt: string;
  signatoryName?: string;
  className?: string;
}

/**
 * Digital "Approved" stamp effect for signed clearance items.
 */
export default function ApprovedStamp({ signedAt, signatoryName, className }: ApprovedStampProps) {
  const dateStr = new Date(signedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={cn(
        'relative inline-flex flex-col items-center justify-center px-4 py-2 rounded border-2 border-emerald-500/80',
        'bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
        'transform -rotate-[-6deg] shadow-md',
        className
      )}
      style={{
        fontFamily: 'Georgia, serif',
        minWidth: '120px',
      }}
    >
      <span className="text-lg font-bold tracking-wider uppercase">Approved</span>
      {signatoryName && (
        <span className="text-xs mt-0.5 font-medium truncate max-w-[100px]" title={signatoryName}>
          {signatoryName}
        </span>
      )}
      <span className="text-xs opacity-90">{dateStr}</span>
    </div>
  );
}
