// Encode a result summary into a URL fragment and back. Only aggregate scores
// are included (no answers, no questions, nothing about the player), and the
// fragment never reaches a server.

const b64url = {
  encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(s) {
    const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(pad);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  },
};

const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

export function encodeResult(s) {
  const payload = {
    v: 1,
    n: s.n,
    a: r3(s.accuracy),
    c: r3(s.meanConfidence),
    d: r3(s.auroc2),
    b: r3(s.brier),
    t: s.table.map((g) => [Math.round(g.confidence * 100), g.n, g.correct]),
  };
  return b64url.encode(JSON.stringify(payload));
}

export function decodeResult(str) {
  let p;
  try {
    p = JSON.parse(b64url.decode(str));
  } catch {
    return null;
  }
  const isNum = (x) => typeof x === "number" && Number.isFinite(x);
  if (!p || p.v !== 1 || !isNum(p.n) || p.n < 1 || p.n > 200 || !Array.isArray(p.t)) return null;
  for (const k of ["a", "c", "b"]) if (!isNum(p[k]) || p[k] < 0 || p[k] > 1) return null;
  if (p.d !== null && (!isNum(p.d) || p.d < 0 || p.d > 1)) return null;
  const table = [];
  for (const row of p.t.slice(0, 20)) {
    if (!Array.isArray(row) || row.length !== 3 || !row.every(isNum)) return null;
    const [conf, n, correct] = row;
    if (conf < 50 || conf > 100 || n < 1 || correct < 0 || correct > n) return null;
    table.push({ confidence: conf / 100, n, correct, accuracy: correct / n });
  }
  return {
    n: p.n, accuracy: p.a, meanConfidence: p.c, overconfidence: p.c - p.a,
    auroc2: p.d === null ? NaN : p.d, brier: p.b, table,
  };
}
