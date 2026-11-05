type Point = { confidence: number; accuracy: number; n: number };
type Series = { label: string; color: string; points: Point[] };

/** Accuracy at each confidence level. Dots on the dashed diagonal = honest confidence. */
export function CalibrationChart({ series, height = 300 }: { series: Series[]; height?: number }) {
  const W = 440;
  const H = height;
  const L = 58;
  const R = 14;
  const T = 14;
  const B = 44;
  const x = (c: number) => L + ((c - 0.5) / 0.5) * (W - L - R);
  const y = (a: number) => T + (1 - a) * (H - T - B);
  const maxN = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.n)));
  const label = series.map((s) => `${s.label}: ${s.points.map((p) => `${Math.round(p.confidence * 100)}% sure, ${Math.round(p.accuracy * 100)}% right`).join("; ")}`).join(". ");

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Calibration chart. ${label}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {t * 100}%
            </text>
          </g>
        ))}
        {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((t) => (
          <text key={t} x={x(t)} y={H - B + 18} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {Math.round(t * 100)}%
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
          how sure you said you were
        </text>
        <text transform={`translate(14 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="var(--muted)">
          how often you were right
        </text>
        <line x1={x(0.5)} y1={y(0.5)} x2={x(1)} y2={y(1)} stroke="var(--muted)" strokeDasharray="4 4" />
        {series.map((s) => (
          <g key={s.label}>
            {s.points.length > 1 && (
              <polyline fill="none" stroke={s.color} strokeWidth={2} points={s.points.map((p) => `${x(p.confidence)},${y(p.accuracy)}`).join(" ")} />
            )}
            {s.points.map((p) => (
              <circle key={p.confidence} cx={x(p.confidence)} cy={y(p.accuracy)} r={4 + 8 * Math.sqrt(p.n / maxN)} fill={s.color} fillOpacity={0.85}>
                <title>{`${s.label}: said ${Math.round(p.confidence * 100)}%, right ${Math.round(p.accuracy * 100)}% (${p.n})`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
