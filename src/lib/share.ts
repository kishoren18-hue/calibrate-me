// Encode a result into a URL fragment and back. Only aggregate scores are
// included (no answers, no questions, nothing about the player), and the
// fragment never reaches a server.

import type { Bin, Summary } from "./stats";

function toB64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const r3 = (v: number) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

export type SharedResult = Pick<Summary, "n" | "accuracy" | "meanConfidence" | "overconfidence" | "auroc2" | "brier" | "table">;

export function encodeResult(s: SharedResult): string {
  return toB64Url(
    JSON.stringify({
      v: 1,
      n: s.n,
      a: r3(s.accuracy),
      c: r3(s.meanConfidence),
      d: r3(s.auroc2),
      b: r3(s.brier),
      t: s.table.map((g) => [Math.round(g.confidence * 100), g.n, g.correct]),
    }),
  );
}

export function decodeResult(str: string): SharedResult | null {
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(fromB64Url(str));
  } catch {
    return null;
  }
  const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  if (!p || p.v !== 1 || !isNum(p.n) || p.n < 1 || p.n > 200 || !Array.isArray(p.t)) return null;
  for (const k of ["a", "c", "b"]) if (!isNum(p[k]) || (p[k] as number) < 0 || (p[k] as number) > 1) return null;
  if (p.d !== null && (!isNum(p.d) || p.d < 0 || p.d > 1)) return null;
  const table: Bin[] = [];
  for (const row of (p.t as unknown[]).slice(0, 20)) {
    if (!Array.isArray(row) || row.length !== 3 || !row.every(isNum)) return null;
    const [conf, n, correct] = row as number[];
    if (conf < 50 || conf > 100 || n < 1 || correct < 0 || correct > n) return null;
    table.push({ confidence: conf / 100, n, correct, accuracy: correct / n });
  }
  const a = p.a as number;
  const c = p.c as number;
  return {
    n: p.n,
    accuracy: a,
    meanConfidence: c,
    overconfidence: c - a,
    auroc2: p.d === null ? NaN : (p.d as number),
    brier: p.b as number,
    table,
  };
}
