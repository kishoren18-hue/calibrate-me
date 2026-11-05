import { CalibrationChart } from "@/components/calibration-chart";
import { ButtonLink, Card, Stat } from "@/components/ui";
import { MODEL_COLORS, aiFile, modelByQuestion, modelTrials } from "@/lib/ai";
import { QUESTION_BY_ID } from "@/lib/questions";
import { calibrationTable, num, pct, summarize } from "@/lib/stats";
import { getPublicClient } from "@/lib/supabase/public";

export const metadata = { title: "Humans vs. AI" };
export const revalidate = 300;

type QStat = { question_id: string; n: number; accuracy: number; mean_conf: number };
type Cal = { confidence: number; n: number; accuracy: number };

const signed = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}`;

export default async function VsAi() {
  const supabase = getPublicClient();
  let humanQ: QStat[] = [];
  let humanCal: Cal[] = [];
  if (supabase) {
    const [q, c] = await Promise.all([supabase.rpc("cm_question_stats"), supabase.rpc("cm_global_calibration")]);
    humanQ = (q.data ?? []) as QStat[];
    humanCal = (c.data ?? []) as Cal[];
  }
  const humanN = humanCal.reduce((s, b) => s + Number(b.n), 0);
  const humanAcc = humanN ? humanCal.reduce((s, b) => s + b.accuracy * Number(b.n), 0) / humanN : NaN;
  const humanConf = humanN ? humanCal.reduce((s, b) => s + b.confidence * Number(b.n), 0) / humanN : NaN;

  const models = aiFile.models
    .map((m, i) => {
      const trials = modelTrials(m);
      return { ...m, color: MODEL_COLORS[i % MODEL_COLORS.length], trials, summary: trials.length ? summarize(trials) : null, byQ: modelByQuestion(m) };
    })
    .filter((m) => m.summary);

  // Questions where people and the models (on average) differ most in accuracy.
  const contrasts = humanQ
    .map((h) => {
      const per = models.map((m) => m.byQ.get(h.question_id)).filter((x): x is { acc: number; conf: number } => !!x);
      if (!per.length) return null;
      const acc = per.reduce((s, x) => s + x.acc, 0) / per.length;
      const conf = per.reduce((s, x) => s + x.conf, 0) / per.length;
      return { ...h, ai: { acc, conf }, gap: acc - h.accuracy };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 8);

  const series = [
    ...(humanCal.length ? [{ label: `People (${humanN.toLocaleString()} answers)`, color: "var(--accent)", points: humanCal.map((b) => ({ ...b, n: Number(b.n) })) }] : []),
    ...models.map((m) => ({ label: m.model, color: m.color, points: calibrationTable(m.trials) })),
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-accent">Same questions, same scale</p>
      <h1 className="font-serif text-4xl font-semibold sm:text-5xl">Humans vs. AI</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        AI models from different companies answer every question in the game and rate their confidence on the same 50–99% scale
        players use. People&apos;s answers are pooled anonymously. Who knows better when they&apos;re wrong?
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">People</h2>
          {humanN ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Accuracy" value={pct(humanAcc)} />
              <Stat label="Overconfidence" value={signed(humanConf - humanAcc)} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Not enough rounds yet. Each question needs at least 5 answers before it&apos;s shown.</p>
          )}
        </Card>
        {models.length === 0 && (
          <Card>
            <h2 className="font-semibold">AI models</h2>
            <p className="mt-2 text-sm text-muted">The models&apos; answers haven&apos;t been generated yet.</p>
          </Card>
        )}
        {models.map((m) => (
          <Card key={m.model}>
            <h2 className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} aria-hidden />
              <span className="font-mono text-sm">{m.model}</span>
              <span className="text-xs font-normal text-muted">{m.provider}</span>
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Accuracy" value={pct(m.summary!.accuracy)} />
              <Stat label="Overconfidence" value={signed(m.summary!.overconfidence)} />
              <Stat label="Discrimination" value={num(m.summary!.auroc2)} />
            </div>
          </Card>
        ))}
      </div>

      {series.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-2 font-semibold">Calibration</h2>
          <CalibrationChart series={series} />
        </Card>
      )}

      {contrasts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Where people and AI differ most</h2>
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
                    AI: {pct(r.ai.acc)} right, {pct(r.ai.conf)} sure
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Card className="mt-10 text-sm text-muted">
        <b className="text-ink">Method.</b> {aiFile.method || "Each model is asked every question at temperature 0 with the options in both orders."}{" "}
        Confidence is snapped to the nearest level players can choose. Player data is aggregate only; questions appear once they
        have at least 5 answers. The models&apos; answers are generated by a GitHub Action and committed to the repository.
      </Card>

      <ButtonLink href="/" className="mt-8">
        Add your answers: play a round
      </ButtonLink>
    </main>
  );
}
