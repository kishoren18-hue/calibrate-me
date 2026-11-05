import assert from "node:assert/strict";
import test from "node:test";

import { decodeResult, encodeResult } from "../share.js";
import { summarize } from "../stats.js";

const T = (correct, confidence) => ({ correct, confidence });
const trials = [T(true, 0.9), T(true, 0.9), T(false, 0.9), T(true, 0.6), T(false, 0.6), T(false, 0.5)];

test("share link round-trips the summary", () => {
  const s = summarize(trials);
  const back = decodeResult(encodeResult(s));
  assert.equal(back.n, s.n);
  assert.ok(Math.abs(back.accuracy - s.accuracy) < 1e-3);
  assert.ok(Math.abs(back.overconfidence - s.overconfidence) < 2e-3);
  assert.deepEqual(back.table.map((g) => [g.confidence, g.n, g.correct]), s.table.map((g) => [g.confidence, g.n, g.correct]));
});

test("encoded link is URL-safe and contains no question text", () => {
  const enc = encodeResult(summarize(trials));
  assert.match(enc, /^[A-Za-z0-9_-]+$/);
  assert.ok(enc.length < 200);
});

test("tampered or garbage links are rejected", () => {
  assert.equal(decodeResult("not-base64!!"), null);
  assert.equal(decodeResult(""), null);
  const bad = Buffer.from(JSON.stringify({ v: 1, n: 5, a: 2, c: 0.5, d: 0.5, b: 0.2, t: [] })).toString("base64url");
  assert.equal(decodeResult(bad), null);
  const badRow = Buffer.from(JSON.stringify({ v: 1, n: 5, a: 0.5, c: 0.5, d: 0.5, b: 0.2, t: [[70, 2, 5]] })).toString("base64url");
  assert.equal(decodeResult(badRow), null);
});

test("undefined discrimination survives the round trip", () => {
  const s = summarize([T(true, 0.9), T(true, 0.7)]); // no errors -> AUROC undefined
  const back = decodeResult(encodeResult(s));
  assert.ok(Number.isNaN(back.auroc2));
});
