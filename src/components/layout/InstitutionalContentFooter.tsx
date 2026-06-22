/**
 * Same footer strip as the public / Index page, shown under institutional (dashboard) main content.
 */
import { INSTITUTIONAL_FOOTER_MOTTO_LINE } from '@/constants/institutionBranding';

export function InstitutionalContentFooter() {
  return (
    <footer className="mt-auto w-full min-w-0 shrink-0 border-t border-amber-800/20 bg-amber-700/80 px-[max(1rem,env(safe-area-inset-left))] py-3.5 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.875rem,env(safe-area-inset-bottom))] text-center">
      <p className="text-xs font-medium leading-snug text-white sm:text-sm">
        <span className="break-words">{INSTITUTIONAL_FOOTER_MOTTO_LINE}</span>
      </p>
    </footer>
  );
}
