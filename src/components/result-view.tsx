import { num, pct, type Summary, verdict } from "@/lib/stats";

import { CalibrationChart } from "./calibration-chart";
import { Card, Stat } from "./ui";

type R = Pick<Summary, "n" | "accuracy" | "meanConfidence" | "overconfidence" | "auroc2" | "brier" | "table">;

export function ResultView({ s, title }: { s: R; title?: string }) {
  return (
    <div className="space-y-6">
      <div>
        {title && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">{title}</p>}
        <h2 className="font-serif text-2xl leading-snug sm:text-3xl">{verdict(s)}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Accuracy" value={pct(s.accuracy)} hint={`${s.n} questions`} />
        <Stat label="Average confidence" value={pct(s.meanConfidence)} hint="how sure you felt" />
        <Stat label="Overconfidence" value={`${s.overconfidence >= 0 ? "+" : ""}${Math.round(s.overconfidence * 100)}`} hint="confidence minus accuracy" />
        <Stat label="Discrimination" value={num(s.auroc2)} hint="0.5 = none, 1 = perfect" />
        <Stat label="Brier score" value={num(s.brier, 3)} hint="lower is better" />
      </div>
      <Card>
        <CalibrationChart series={[{ label: "You", color: "var(--accent)", points: s.table }]} />
        <p className="mt-2 text-sm text-muted">
          Dots on the dashed line mean your confidence was honest. Dots below it mean you were overconfident at that level.
        </p>
      </Card>
    </div>
  );
}
