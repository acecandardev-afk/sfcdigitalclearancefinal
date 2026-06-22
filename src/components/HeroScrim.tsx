/**
 * Shared hero overlays for full-bleed campus images (landing + auth).
 */
export function HeroScrim({ light = false }: { light?: boolean }) {
  if (light) {
    return (
      <>
        <div
          className="absolute inset-0 bg-gradient-to-b from-slate-900/12 via-amber-950/4 to-slate-950/18"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-slate-950/14 via-transparent to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_28%_12%,hsl(0,0%,0%,0.03),transparent_55%)]"
          aria-hidden
        />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.04]" aria-hidden />
      </>
    );
  }

  return (
    <>
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-900/34 via-amber-950/14 to-slate-950/44"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-slate-950/36 via-slate-900/10 to-slate-900/2"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_30%_10%,hsl(0,0%,0%,0.10),transparent_58%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 ring-1 ring-inset ring-white/[0.08]"
        aria-hidden
      />
    </>
  );
}
