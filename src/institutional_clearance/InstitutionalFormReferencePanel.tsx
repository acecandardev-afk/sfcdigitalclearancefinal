import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { INSTITUTIONAL_CLEARANCE_OFFICE_ROWS } from '@/lib/institutionalOffices';
import { cn } from '@/lib/utils';

/**
 * Read-only description of the paper-equivalent institutional (employee) form.
 * Shown on the signatory queue so users see who signs where (esp. Section II order).
 */
export function InstitutionalFormReferencePanel({ className = '' }: { className?: string }) {
  return (
    <Card className={cn('border-dashed border-amber-800/30 bg-amber-50/40 dark:border-amber-700/30 dark:bg-amber-950/20', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Institutional form (employees / staff)</CardTitle>
        <CardDescription>
          This module is for <span className="font-medium text-foreground">faculty and employee exit</span> — not
          the student clearance program. Section II below is the office line-up you sign in sequence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <section>
          <h3 className="font-semibold text-foreground">Section I — Personal information</h3>
          <p className="mt-1">Name, position, type (Teaching or Non-Teaching), department/office, date of separation, reason for
            clearance (resignation, end of contract, transfer, or others).</p>
        </section>
        <section>
          <h3 className="font-semibold text-foreground">Section II — Clearance by office (order matters)</h3>
          <p className="mb-2">Each office confirms the employee has no remaining liability there. You will act on the line that
            matches <span className="text-foreground">your assigned office</span> when it is the active step.</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-xs leading-relaxed sm:text-sm">
            {INSTITUTIONAL_CLEARANCE_OFFICE_ROWS.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ol>
          <p className="mt-2 text-xs italic">Default office order. Each clearance may use labels saved for that form; the queue
            always shows the exact office name on the line you are signing.</p>
        </section>
        <section>
          <h3 className="font-semibold text-foreground">Section III — Certification</h3>
          <p>Prepared by, checked and verified by (HRMDO), approved by (College President) — final validation after Section II.</p>
        </section>
        <section>
          <h3 className="font-semibold text-foreground">Section IV — Final clearance</h3>
          <p>Outcome (cleared / not cleared) and remarks; required before final pay, credentials, and other exit benefits; attach
            supporting documents as needed.</p>
        </section>
      </CardContent>
    </Card>
  );
}
