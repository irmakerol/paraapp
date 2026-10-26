import { WIND_DIRECTIONS } from '@paraapp/core';

/** Eight sectors; the ones a site works in are filled. */
export function WindRose({
  directions,
  label,
  short,
}: {
  directions: string[];
  label: string;
  short: (d: string) => string;
}) {
  const r = 46;
  return (
    <svg viewBox="-60 -60 120 120" className="size-32" role="img" aria-label={label}>
      {WIND_DIRECTIONS.map((d, i) => {
        const a0 = ((i * 45 - 22.5 - 90) * Math.PI) / 180;
        const a1 = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
        const on = directions.includes(d);
        const la = ((i * 45 - 90) * Math.PI) / 180;
        return (
          <g key={d}>
            <path
              d={`M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`}
              className={on ? 'fill-brand-orange' : 'fill-border'}
              stroke="var(--background)"
              strokeWidth={1.5}
            />
            <text
              x={55 * Math.cos(la)}
              y={55 * Math.sin(la)}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-[9px] font-bold"
            >
              {short(d)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
