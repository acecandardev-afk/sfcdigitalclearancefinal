/**
 * Branded page header with school logo (matches visibility of student clearance marketing).
 */
import { APP_LOGO_SRC } from '@/constants/institutionBranding';

export function InstitutionalPageBrand({
  title,
  subtitle,
  className = '',
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div
      className={`mb-6 flex min-w-0 flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-center ${className}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <img
          src={APP_LOGO_SRC}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl border border-border/60 bg-card object-contain p-0.5 shadow-sm sm:h-14 sm:w-14"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            E-Clear SFCG · Institutional
          </p>
          <h1 className="text-balance break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-pretty break-words text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
