import { HeroScrim } from '@/components/HeroScrim';
import { LANDING_BG_IMAGE } from '@/constants/institutionBranding';

/** Shared campus photo + light scrim for landing and auth pages. */
export function LandingPageBackground() {
  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: `url(${LANDING_BG_IMAGE})` }}
        aria-hidden
      />
      <HeroScrim light />
    </>
  );
}
