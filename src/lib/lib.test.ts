import { describe, expect, it } from "vitest";

import { deal, QUESTIONS } from "./questions";
import { decodeResult, encodeResult } from "./share";
import { auroc2, brier, calibrationTable, summarize, type Trial, verdict } from "./stats";

const T = (correct: boolean, confidence: number): Trial => ({ correct, confidence });
const trials = [T(true, 0.9), T(true, 0.9), T(false, 0.9), T(true, 0.6), T(false, 0.6), T(false, 0.5)];

describe("stats", () => {
  it("brier", () => expect(brier([T(true, 1), T(false, 0.5)])).toBeCloseTo(0.125));
  it("type-2 AUROC", () => {
    expect(auroc2([T(true, 0.9), T(false, 0.6)])).toBe(1);
    expect(auroc2([T(true, 0.6), T(false, 0.9)])).toBe(0);
    expect(auroc2([T(true, 0.7), T(false, 0.7)])).toBe(0.5);
    expect(auroc2([T(true, 0.7)])).toBeNaN();
  });
  it("calibration table", () => {
    expect(calibrationTable([T(true, 0.7), T(false, 0.7), T(true, 0.9)]).map((g) => [g.confidence, g.n, g.accuracy])).toEqual([
      [0.7, 2, 0.5],
      [0.9, 1, 1],
    ]);
  });
  it("Murphy decomposition adds up to the Brier score", () => {
    const s = summarize(trials);
    expect(s.reliability - s.resolution + s.uncertainty).toBeCloseTo(s.brier, 12);
  });
  it("verdict", () => expect(verdict(summarize([T(false, 0.99), T(false, 0.99), T(true, 0.99), T(true, 0.5)]))).toMatch(/overconfident/));
});

describe("share links", () => {
  it("round-trip", () => {
    const s = summarize(trials);
    const back = decodeResult(encodeResult(s))!;
    expect(back.n).toBe(s.n);
    expect(back.overconfidence).toBeCloseTo(s.overconfidence, 2);
    expect(back.table.map((g) => g.n)).toEqual(s.table.map((g) => g.n));
  });
  it("are URL-safe and short", () => {
    const enc = encodeResult(summarize(trials));
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(enc.length).toBeLessThan(200);
  });
  it("reject tampering", () => {
    expect(decodeResult("garbage!!")).toBeNull();
    const bad = Buffer.from(JSON.stringify({ v: 1, n: 5, a: 0.5, c: 0.5, d: 0.5, b: 0.2, t: [[70, 2, 5]] })).toString("base64url");
    expect(decodeResult(bad)).toBeNull();
  });
});

describe("question bank", () => {
  it("is well formed and unique", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect([0, 1]).toContain(q.correct);
      expect(q.options[0]).not.toBe(q.options[1]);
    }
  });
  it("deals the requested number without repeats", () => {
    const d = deal(20);
    expect(d).toHaveLength(20);
    expect(new Set(d.map((q) => q.id)).size).toBe(20);
  });
});
