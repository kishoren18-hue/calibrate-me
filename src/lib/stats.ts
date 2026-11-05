// Scoring for confidence judgments. Each trial: correct (bool) + confidence in [0.5, 1].

export type Trial = { correct: boolean; confidence: number };
export type Bin = { confidence: number; n: number; correct: number; accuracy: number };
export type Summary = {
  n: number;
  accuracy: number;
  meanConfidence: number;
  overconfidence: number;
  brier: number;
  auroc2: number;
  table: Bin[];
  reliability: number;
  resolution: number;
  uncertainty: number;
};

export function brier(trials: Trial[]): number {
  if (!trials.length) return NaN;
  return trials.reduce((s, t) => s + (t.confidence - (t.correct ? 1 : 0)) ** 2, 0) / trials.length;
}

export function accuracy(trials: Trial[]): number {
  return trials.length ? trials.filter((t) => t.correct).length / trials.length : NaN;
}

export function meanConfidence(trials: Trial[]): number {
  return trials.length ? trials.reduce((s, t) => s + t.confidence, 0) / trials.length : NaN;
}

/** Type-2 AUROC: P(confidence on a right answer > confidence on a wrong one); ties count half. */
export function auroc2(trials: Trial[]): number {
  const pos = trials.filter((t) => t.correct).map((t) => t.confidence);
  const neg = trials.filter((t) => !t.correct).map((t) => t.confidence);
  if (!pos.length || !neg.length) return NaN;
  let s = 0;
  for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

export function calibrationTable(trials: Trial[]): Bin[] {
  const groups = new Map<number, { n: number; correct: number }>();
  for (const t of trials) {
    const k = Math.round(t.confidence * 100);
    const g = groups.get(k) ?? { n: 0, correct: 0 };
    g.n += 1;
    g.correct += t.correct ? 1 : 0;
    groups.set(k, g);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, g]) => ({ confidence: k / 100, n: g.n, correct: g.correct, accuracy: g.correct / g.n }));
}

export function summarize(trials: Trial[]): Summary {
  const n = trials.length;
  const acc = accuracy(trials);
  const table = calibrationTable(trials);
  let rel = 0;
  let res = 0;
  for (const g of table) {
    rel += g.n * (g.confidence - g.accuracy) ** 2;
    res += g.n * (g.accuracy - acc) ** 2;
  }
  const mc = meanConfidence(trials);
  return {
    n,
    accuracy: acc,
    meanConfidence: mc,
    overconfidence: mc - acc,
    brier: brier(trials),
    auroc2: auroc2(trials),
    table,
    reliability: n ? rel / n : NaN,
    resolution: n ? res / n : NaN,
    uncertainty: acc * (1 - acc),
  };
}

export function verdict(s: Pick<Summary, "n" | "overconfidence" | "auroc2">): string {
  if (!s.n) return "";
  const oc = s.overconfidence;
  let cal: string;
  if (Math.abs(oc) < 0.05) cal = "Your confidence matched your accuracy well.";
  else if (oc > 0) cal = `You were overconfident by ${Math.round(oc * 100)} points: you felt more sure than your results justified.`;
  else cal = `You were underconfident by ${Math.round(-oc * 100)} points: you knew more than you gave yourself credit for.`;
  let sens = "";
  if (Number.isFinite(s.auroc2)) {
    if (s.auroc2 >= 0.75) sens = " Your confidence did a good job telling apart what you knew from what you didn't.";
    else if (s.auroc2 >= 0.6) sens = " Your confidence was somewhat informative about which answers were right.";
    else sens = " Your confidence barely distinguished right answers from wrong ones; try using the full scale.";
  }
  return cal + sens;
}

export const pct = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? `${Math.round(v * 100)}%` : "–");
export const num = (v: number | null | undefined, d = 2) => (v != null && Number.isFinite(v) ? v.toFixed(d) : "–");
