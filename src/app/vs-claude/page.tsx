import { CalibrationChart } from "@/components/calibration-chart";
import { ButtonLink, Card, Stat } from "@/components/ui";
import { claude, claudeTrials } from "@/lib/claude";
import { QUESTION_BY_ID } from "@/lib/questions";
import { calibrationTable, num, pct, summarize } from "@/lib/stats";
import { getPublicClient } from "@/lib/supabase/public";

export const metadata = { title: "Humans vs. Claude" };
export const revalidate = 300;

type QStat = { question_id: string; n: number; accuracy: number; mean_conf: number };
type Cal = { confidence: number; n: number; accuracy: number };

export default async function VsClaude() {
  const supabase = getPublicClient();
  let humanQ: QStat[] = [];
  let humanCal: Cal[] = [];
  if (supabase) {
    const [q, c] = await Promise.all([supabase.rpc("cm_question_stats"), supabase.rpc("cm_global_calibration")]);
    humanQ = (q.data ?? []) as QStat[];
    humanCal = (c.data ?? []) as Cal[];
  }
  const ct = claudeTrials();
  const cs = ct.length ? summarize(ct) : null;
  const humanN = humanCal.reduce((s, b) => s + Number(b.n), 0);
  const humanAcc = humanN ? humanCal.reduce((s, b) => s + b.accuracy * Number(b.n), 0) / humanN : NaN;
  const humanConf = humanN ? humanCal.reduce((s, b) => s + b.confidence * Number(b.n), 0) / humanN : NaN;

  const claudeByQ = new Map<string, { acc: number; conf: number }>();
  for (const [qid, trials] of Object.entries(claude.answers)) {
    claudeByQ.set(qid, {
      acc: trials.filter((t) => t.correct).length / trials.length,
      conf: trials.reduce((s, t) => s + t.confidence, 0) / trials.length,
    });
  }
  const contrasts = humanQ
    .filter((h) => claudeByQ.has(h.question_id))
    .map((h) => ({ ...h, c: claudeByQ.get(h.question_id)!, gap: claudeByQ.get(h.question_id)!.acc - h.accuracy }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 8);

  const series = [
    ...(humanCal.length ? [{ label: `People (${humanN.toLocaleString()} answers)`, color: "var(--accent)", points: humanCal.map((b) => ({ ...b, n: Number(b.n) })) }] : []),
    ...(cs ? [{ label: `Claude (${claude.model})`, color: "#4f46e5", points: calibrationTable(ct) }] : []),
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-accent">Same questions, same scale</p>
      <h1 className="font-serif text-4xl font-semibold sm:text-5xl">Humans vs. Claude</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Claude answers every question in the game and rates its confidence on the same 50–99% scale players use. People&apos;s
        answers are pooled anonymously. Who knows better when they&apos;re wrong?
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">People</h2>
          {humanN ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Accuracy" value={pct(humanAcc)} />
              <Stat label="Overconfidence" value={`${humanConf - humanAcc >= 0 ? "+" : ""}${Math.round((humanConf - humanAcc) * 100)}`} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Not enough rounds yet. Each question needs at least 5 answers before it&apos;s shown.</p>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">Claude {claude.model && <span className="font-mono text-sm font-normal text-muted">{claude.model}</span>}</h2>
          {cs ? (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Accuracy" value={pct(cs.accuracy)} />
              <Stat label="Overconfidence" value={`${cs.overconfidence >= 0 ? "+" : ""}${Math.round(cs.overconfidence * 100)}`} />
              <Stat label="Discrimination" value={num(cs.auroc2)} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Claude&apos;s answers haven&apos;t been generated yet.</p>
          )}
        </Card>
      </div>

      {series.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-2 font-semibold">Calibration</h2>
          <CalibrationChart series={series} />
        </Card>
      )}

      {contrasts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Where people and Claude differ most</h2>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {contrasts.map((r) => {
              const q = QUESTION_BY_ID.get(r.question_id);
              return (
                <li key={r.question_id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto]">
                  <span>
                    {q?.question} <span className="text-muted">({q?.options[q.correct]})</span>
                  </span>
                  <span className="text-muted">
                    People: {pct(r.accuracy)} right, {pct(r.mean_conf)} sure
                  </span>
                  <span className="text-muted">
                    Claude: {pct(r.c.acc)} right, {pct(r.c.conf)} sure
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Card className="mt-10 text-sm text-muted">
        <b className="text-ink">Method.</b> {claude.method || "Claude is asked each question at temperature 0 with the options in both orders."}{" "}
        Its confidence is snapped to the nearest level players can choose. Player data is aggregate only; questions appear once they
        have at least 5 answers. Claude&apos;s answers are generated by a GitHub Action and committed to the repository.
      </Card>

      <ButtonLink href="/" className="mt-8">
        Add your answers: play a round
      </ButtonLink>
    </main>
  );
}
