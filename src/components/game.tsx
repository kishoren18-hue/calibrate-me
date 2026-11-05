"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { type Dealt, deal } from "@/lib/questions";
import { encodeResult } from "@/lib/share";
import { pct, summarize, type Summary } from "@/lib/stats";
import { getBrowserClient } from "@/lib/supabase/client";

import { ResultView } from "./result-view";
import { Alert, Button, cx } from "./ui";

const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
const ROUND_OPTIONS = [10, 20, 40];
const HISTORY_KEY = "calibrate-me:sessions:v2";

type Answer = { q: Dealt; pick: 0 | 1; correct: boolean; confidence: number };
type SavedSession = { at: number; n: number; accuracy: number; overconfidence: number };

function loadHistory(): SavedSession[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveHistory(s: Summary) {
  try {
    const all = loadHistory();
    all.push({ at: Date.now(), n: s.n, accuracy: s.accuracy, overconfidence: s.overconfidence });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all.slice(-50)));
  } catch {
    /* storage unavailable */
  }
}

export function Game({ classCode, className, nickname }: { classCode?: string; className?: string; nickname?: string }) {
  const inClass = Boolean(classCode);
  const [phase, setPhase] = useState<"setup" | "play" | "done">(inClass ? "setup" : "setup");
  const [rounds, setRounds] = useState(inClass ? 20 : 20);
  const [items, setItems] = useState<Dealt[]>([]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<0 | 1 | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [contribute, setContribute] = useState(true);
  const [submit, setSubmit] = useState<"idle" | "sending" | "ok" | "error" | "off">("idle");
  const [submitMsg, setSubmitMsg] = useState("");
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => setHistory(loadHistory()), []);

  const current = items[i];
  const revealed = answers.length > i;

  const start = () => {
    setItems(deal(rounds));
    setI(0);
    setPick(null);
    setAnswers([]);
    setSubmit("idle");
    setPhase("play");
  };

  const finish = useCallback(
    async (all: Answer[]) => {
      setPhase("done");
      const s = summarize(all);
      saveHistory(s);
      setHistory(loadHistory());
      const supabase = getBrowserClient();
      if (!supabase || (!inClass && !contribute)) return setSubmit("off");
      setSubmit("sending");
      const { error } = await supabase.rpc("cm_submit_session", {
        p_answers: all.map((a) => ({ q: a.q.id, c: a.correct, p: a.confidence })),
        p_code: classCode ?? null,
        p_nickname: nickname ?? null,
      });
      if (error) {
        setSubmit("error");
        setSubmitMsg(error.message);
      } else setSubmit("ok");
    },
    [classCode, nickname, inClass, contribute],
  );

  const commit = useCallback(
    (confidence: number) => {
      if (pick === null || !current || revealed) return;
      const correctIndex = current.order.indexOf(current.correct) as 0 | 1;
      setAnswers((a) => [...a, { q: current, pick, correct: pick === correctIndex, confidence }]);
    },
    [pick, current, revealed],
  );

  const next = useCallback(() => {
    if (i + 1 >= items.length) return finish(answers);
    setI(i + 1);
    setPick(null);
  }, [i, items.length, answers, finish]);

  useEffect(() => {
    if (phase === "play" && !revealed) headingRef.current?.focus({ preventScroll: true });
  }, [phase, i, revealed]);

  useEffect(() => {
    if (phase !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (!revealed && (k === "a" || k === "b")) setPick(k === "a" ? 0 : 1);
      else if (!revealed && /^[1-6]$/.test(k)) commit(LEVELS[+k - 1]);
      else if (revealed && (k === "enter" || k === " ")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, revealed, commit, next]);

  if (phase === "setup") {
    const last = history[history.length - 1];
    return (
      <div className="space-y-6">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm text-muted">Round length</legend>
          {ROUND_OPTIONS.map((n) => (
            <label key={n} className={cx("cursor-pointer rounded-lg border px-4 py-2 text-sm", rounds === n ? "border-ink bg-surface-2 font-medium" : "border-line bg-surface")}>
              <input type="radio" name="rounds" value={n} checked={rounds === n} onChange={() => setRounds(n)} className="sr-only" />
              {n} questions
            </label>
          ))}
        </fieldset>
        {!inClass && (
          <label className="flex max-w-xl items-start gap-2 text-sm text-muted">
            <input type="checkbox" checked={contribute} onChange={(e) => setContribute(e.target.checked)} className="mt-1" />
            <span>
              Add my answers anonymously to the{" "}
              <Link href="/vs-ai" className="underline">
                humans vs. AI
              </Link>{" "}
              comparison. No name, email or account is stored.
            </span>
          </label>
        )}
        <Button onClick={start} className="px-6 py-3 text-base">
          Start
        </Button>
        {last && (
          <p className="text-sm text-muted">
            Last time on this device: {pct(last.accuracy)} correct, {last.overconfidence > 0 ? "overconfident" : "underconfident"} by{" "}
            {Math.round(Math.abs(last.overconfidence) * 100)} points.
          </p>
        )}
      </div>
    );
  }

  if (phase === "play" && current) {
    const a = answers[i];
    const correctIndex = current.order.indexOf(current.correct);
    const options = current.order.map((o) => current.options[o]);
    return (
      <div>
        <div className="mb-5 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-accent transition-all" style={{ width: `${(i / items.length) * 100}%` }} />
        </div>
        <div className="mb-2 flex justify-between text-sm text-muted">
          <span>
            Question {i + 1} of {items.length}
            {className && ` · ${className}`}
          </span>
          <span className="hidden font-mono text-xs sm:inline">keys: A / B, then 1–6</span>
        </div>
        <h2 ref={headingRef} tabIndex={-1} id="q" className="mb-6 font-serif text-2xl leading-snug outline-none sm:text-3xl">
          {current.question}
        </h2>
        <div role="group" aria-labelledby="q" className="grid gap-3 sm:grid-cols-2">
          {options.map((o, k) => (
            <button
              key={k}
              disabled={revealed}
              aria-pressed={pick === k}
              onClick={() => setPick(k as 0 | 1)}
              className={cx(
                "min-h-20 rounded-xl border bg-surface px-5 py-4 text-left text-lg transition",
                !revealed && pick === k && "border-2 border-ink bg-surface-2",
                !revealed && pick !== k && "border-line hover:border-ink",
                revealed && k === correctIndex && "border-2 border-ok",
                revealed && a.pick === k && k !== correctIndex && "border-2 border-danger",
                revealed && k !== correctIndex && a.pick !== k && "border-line opacity-60",
              )}
            >
              <span className="mr-3 font-mono text-sm text-muted">{"AB"[k]}</span>
              {o}
            </button>
          ))}
        </div>
        {!revealed ? (
          <div className={cx("mt-6 transition", pick === null && "opacity-40")}>
            <p className="mb-2 text-sm text-muted">How sure are you?</p>
            <div role="group" aria-label="How sure are you?" className="grid grid-cols-6 gap-2">
              {LEVELS.map((l, k) => (
                <button
                  key={l}
                  disabled={pick === null}
                  onClick={() => commit(l)}
                  className="rounded-lg border border-line bg-surface py-3 font-mono text-sm hover:border-ink disabled:cursor-not-allowed"
                  aria-label={`${Math.round(l * 100)} percent sure (key ${k + 1})`}
                >
                  {Math.round(l * 100)}%
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted">
              <span>pure guess</span>
              <span>certain</span>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-surface-2 p-4" role="status">
              <b className={a.correct ? "text-ok" : "text-danger"}>{a.correct ? "Correct" : "Not quite"}</b>
              <span className="text-muted"> · you said {Math.round(a.confidence * 100)}%</span>
              <p className="mt-1">{current.explanation}</p>
            </div>
            <Button onClick={next} autoFocus>
              {i + 1 === items.length ? "See results" : "Next"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const s = summarize(answers);
  const misses = answers.filter((a) => !a.correct).sort((x, y) => y.confidence - x.confidence).slice(0, 3);
  return (
    <div className="space-y-8">
      <ResultView s={s} title={nickname ? `${nickname}'s results` : "Your results"} />
      {submit === "ok" && inClass && <Alert tone="ok">Your results were sent to {className ?? "your class"}.</Alert>}
      {submit === "error" && (
        <Alert tone="warn" title="Couldn't send results">
          {submitMsg}
        </Alert>
      )}
      {misses.length > 0 && (
        <section>
          <h3 className="mb-2 font-serif text-xl">Your most confident misses</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            {misses.map((m) => (
              <li key={m.q.id}>
                {m.q.question} You said <b>{Math.round(m.confidence * 100)}%</b>; the answer was <b>{m.q.options[m.q.correct]}</b>.
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={start}>Play again</Button>
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(`${location.origin}/shared#r=${encodeResult(s)}`).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? "Link copied" : "Copy share link"}
        </Button>
        <Link href="/vs-ai" className="inline-flex items-center px-3 text-sm text-accent underline">
          How do people compare with AI?
        </Link>
      </div>
      {copied && <p className="text-xs text-muted">The link contains only your scores, not your answers.</p>}
    </div>
  );
}
