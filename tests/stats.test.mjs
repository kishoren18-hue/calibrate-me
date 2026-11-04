import assert from "node:assert/strict";
import test from "node:test";

import { QUESTIONS } from "../questions.js";
import { auroc2, brier, brierDecomposition, calibrationTable, overconfidence, summarize, verdict } from "../stats.js";

const T = (correct, confidence) => ({ correct, confidence });

test("brier score", () => {
  assert.equal(brier([T(true, 1), T(false, 0.5)]), (0 + 0.25) / 2);
});

test("overconfidence sign", () => {
  assert.ok(overconfidence([T(false, 0.9), T(true, 0.9)]) > 0);
  assert.ok(overconfidence([T(true, 0.5), T(true, 0.5)]) < 0);
});

test("type-2 AUROC", () => {
  assert.equal(auroc2([T(true, 0.9), T(false, 0.6)]), 1);
  assert.equal(auroc2([T(true, 0.6), T(false, 0.9)]), 0);
  assert.equal(auroc2([T(true, 0.7), T(false, 0.7)]), 0.5);
  assert.ok(Number.isNaN(auroc2([T(true, 0.7)])));
});

test("calibration table groups by level", () => {
  const tab = calibrationTable([T(true, 0.7), T(false, 0.7), T(true, 0.9)]);
  assert.deepEqual(tab.map((g) => [g.confidence, g.n, g.accuracy]), [[0.7, 2, 0.5], [0.9, 1, 1]]);
});

test("Murphy decomposition adds up to Brier", () => {
  const trials = [T(true, 0.9), T(true, 0.9), T(false, 0.9), T(true, 0.6), T(false, 0.6), T(false, 0.5)];
  const d = brierDecomposition(trials);
  assert.ok(Math.abs(d.reliability - d.resolution + d.uncertainty - brier(trials)) < 1e-12);
});

test("verdict text", () => {
  const s = summarize([T(false, 0.99), T(false, 0.99), T(true, 0.99), T(true, 0.5)]);
  assert.match(verdict(s), /overconfident/);
});

test("question bank is well formed", () => {
  assert.ok(QUESTIONS.length >= 40);
  const seen = new Set();
  for (const q of QUESTIONS) {
    assert.equal(q.length, 5, `bad row: ${q[0]}`);
    assert.ok(q[3] === 0 || q[3] === 1);
    assert.notEqual(q[1], q[2]);
    const key = q[0] + q[1] + q[2];
    assert.ok(!seen.has(key), `duplicate: ${q[0]}`);
    seen.add(key);
  }
});
