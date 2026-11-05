import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CalibrationChart } from "@/components/calibration-chart";
import { Badge, Card, Stat } from "@/components/ui";
import { QUESTION_BY_ID } from "@/lib/questions";
import { calibrationTable, num, pct, summarize } from "@/lib/stats";
import { getServerClient, getUser } from "@/lib/supabase/server";

import { ClassControls, SessionDelete } from "./controls";
import { AutoRefresh } from "./auto-refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Class dashboard" };

type Session = { id: string; nickname: string; n: number; accuracy: number; mean_conf: number; brier: number; auroc2: number | null; created_at: string };
type Answer = { session_id: string; question_id: string; correct: boolean; confidence: number };

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/teach/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = (await getServerClient())!;
  const { data: cls } = await supabase.from("cm_classes").select("id,name,code").eq("id", id).maybeSingle();
  if (!cls) notFound();
  const [{ data: sData }, { data: aData }] = await Promise.all([
    supabase.from("cm_sessions").select("id,nickname,n,accuracy,mean_conf,brier,auroc2,created_at").eq("class_id", id).order("created_at", { ascending: false }),
    supabase.from("cm_answers").select("session_id,question_id,correct,confidence,cm_sessions!inner(class_id)").eq("cm_sessions.class_id", id).limit(20000),
  ]);
  const sessions = (sData ?? []) as Session[];
  const answers = (aData ?? []) as unknown as Answer[];
  const pooled = summarize(answers.map((a) => ({ correct: a.correct, confidence: a.confidence })));
  const students = new Set(sessions.map((s) => s.nickname.toLowerCase())).size;
  const discs = sessions.map((s) => s.auroc2).filter((v): v is number => v != null);

  const byQ = new Map<string, { n: number; right: number; conf: number }>();
  for (const a of answers) {
    const g = byQ.get(a.question_id) ?? { n: 0, right: 0, conf: 0 };
    g.n += 1;
    g.right += a.correct ? 1 : 0;
    g.conf += a.confidence;
    byQ.set(a.question_id, g);
  }
  const fooled = [...byQ.entries()]
    .filter(([, g]) => g.n >= 3)
    .map(([qid, g]) => ({ qid, n: g.n, acc: g.right / g.n, conf: g.conf / g.n }))
    .sort((a, b) => b.conf - b.acc - (a.conf - a.acc))
    .slice(0, 6);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AutoRefresh seconds={10} />
      <Link href="/teach" className="text-sm text-muted hover:text-ink">
        ← Your classes
      </Link>
      <div className="mt-3 flex flex-wrap items-end gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl font-semibold">{cls.name}</h1>
          <p className="mt-1 text-sm text-muted">Results update automatically as students finish.</p>
        </div>
        <ClassControls id={cls.id} code={cls.code} />
      </div>

      {sessions.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="text-lg">Waiting for students…</p>
          <p className="mt-1 text-muted">
            Students go to <b>/join</b> and enter <span className="font-mono tracking-[0.2em]">{cls.code}</span>.
          </p>
        </Card>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Students" value={students} hint={`${sessions.length} rounds played`} />
            <Stat label="Class accuracy" value={pct(pooled.accuracy)} />
            <Stat label="Overconfidence" value={`${pooled.overconfidence >= 0 ? "+" : ""}${Math.round(pooled.overconfidence * 100)}`} hint="confidence minus accuracy" />
            <Stat label="Avg. discrimination" value={discs.length ? num(discs.reduce((s, v) => s + v, 0) / discs.length) : "–"} hint="0.5 = none, 1 = perfect" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <Card>
              <h2 className="mb-2 font-semibold">Class calibration</h2>
              <CalibrationChart series={[{ label: "Class", color: "var(--accent)", points: calibrationTable(answers) }]} />
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold">Questions that fooled the class</h2>
              {fooled.length === 0 ? (
                <p className="text-sm text-muted">Appears once a question has 3 or more answers.</p>
              ) : (
                <ul className="space-y-3">
                  {fooled.map((f) => {
                    const q = QUESTION_BY_ID.get(f.qid);
                    return (
                      <li key={f.qid} className="text-sm">
                        <p className="font-medium">{q?.question ?? f.qid}</p>
                        <p className="text-muted">
                          {pct(f.acc)} right but {pct(f.conf)} sure · answer: {q ? q.options[q.correct] : "?"} · {f.n} answers
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <h2 className="mb-3 mt-10 font-semibold">Students</h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Nickname</th>
                  <th className="px-4 py-3">Questions</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3">Overconfidence</th>
                  <th className="px-4 py-3">Discrimination</th>
                  <th className="px-4 py-3">Finished</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessions.map((s) => {
                  const oc = s.mean_conf - s.accuracy;
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 font-medium">{s.nickname}</td>
                      <td className="px-4 py-2.5 tabular-nums">{s.n}</td>
                      <td className="px-4 py-2.5 tabular-nums">{pct(s.accuracy)}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={Math.abs(oc) < 0.05 ? "ok" : oc > 0 ? "danger" : "neutral"}>
                          {oc >= 0 ? "+" : ""}
                          {Math.round(oc * 100)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{num(s.auroc2)}</td>
                      <td className="px-4 py-2.5 text-muted">{new Date(s.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                      <td className="px-4 py-2.5 text-right">
                        <SessionDelete id={s.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
