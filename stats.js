// Scoring for confidence judgments. Pure functions, shared by the app and the tests.
// Each trial: { correct: boolean, confidence: number in [0.5, 1] }.

export function brier(trials) {
  if (!trials.length) return NaN;
  return trials.reduce((s, t) => s + (t.confidence - (t.correct ? 1 : 0)) ** 2, 0) / trials.length;
}

export function accuracy(trials) {
  return trials.length ? trials.filter((t) => t.correct).length / trials.length : NaN;
}

export function meanConfidence(trials) {
  return trials.length ? trials.reduce((s, t) => s + t.confidence, 0) / trials.length : NaN;
}

// Positive = overconfident, negative = underconfident.
export function overconfidence(trials) {
  return meanConfidence(trials) - accuracy(trials);
}

// Type-2 AUROC: probability that a randomly chosen correct answer got higher
// confidence than a randomly chosen wrong one (ties count half). This is the
// metacognitive-sensitivity measure from cognitive science: 0.5 means your
// confidence carries no information about whether you are right.
export function auroc2(trials) {
  const pos = trials.filter((t) => t.correct).map((t) => t.confidence);
  const neg = trials.filter((t) => !t.correct).map((t) => t.confidence);
  if (!pos.length || !neg.length) return NaN;
  let s = 0;
  for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

// Accuracy at each confidence level the person actually used.
export function calibrationTable(trials) {
  const groups = new Map();
  for (const t of trials) {
    const k = Math.round(t.confidence * 100);
    if (!groups.has(k)) groups.set(k, { confidence: k / 100, n: 0, correct: 0 });
    const g = groups.get(k);
    g.n += 1;
    g.correct += t.correct ? 1 : 0;
  }
  return [...groups.values()]
    .sort((a, b) => a.confidence - b.confidence)
    .map((g) => ({ ...g, accuracy: g.correct / g.n }));
}

// Murphy decomposition of the Brier score: reliability - resolution + uncertainty.
export function brierDecomposition(trials) {
  const n = trials.length;
  if (!n) return { reliability: NaN, resolution: NaN, uncertainty: NaN };
  const base = accuracy(trials);
  let rel = 0;
  let res = 0;
  for (const g of calibrationTable(trials)) {
    rel += g.n * (g.confidence - g.accuracy) ** 2;
    res += g.n * (g.accuracy - base) ** 2;
  }
  return { reliability: rel / n, resolution: res / n, uncertainty: base * (1 - base) };
}

export function summarize(trials) {
  return {
    n: trials.length,
    accuracy: accuracy(trials),
    meanConfidence: meanConfidence(trials),
    overconfidence: overconfidence(trials),
    brier: brier(trials),
    auroc2: auroc2(trials),
    table: calibrationTable(trials),
    ...brierDecomposition(trials),
  };
}

// One sentence of feedback a person can act on.
export function verdict(s) {
  if (!s.n) return "";
  const oc = s.overconfidence;
  let cal;
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
