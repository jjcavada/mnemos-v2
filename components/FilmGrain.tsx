"use client";

/**
 * Subtle film-grain texture overlay (3% opacity, soft-light blend).
 * Sits above the canvas / page content but below interactive UI panels.
 * pointer-events: none so it never intercepts clicks.
 */
export function FilmGrain() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[55] pointer-events-none"
      style={{ opacity: 0.045, mixBlendMode: "overlay" }}
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <filter id="mnemos-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.92"
            numOctaves="2"
            stitchTiles="stitch"
            seed="3"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 1 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#mnemos-grain)" />
      </svg>
    </div>
  );
}
