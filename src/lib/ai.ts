import raw from "@/data/ai-answers.json";

import type { Trial } from "./stats";

export type AiTrial = { correct: boolean; confidence: number; order: number[] };
export type AiModel = { model: string; provider: string; generated_at: string; answers: Record<string, AiTrial[]> };
type AiFile = { method: string; models: AiModel[] };

export const aiFile = raw as AiFile;

/** Chart colors for up to four models; people use the accent color. */
export const MODEL_COLORS = ["#4f46e5", "#0891b2", "#9333ea", "#be123c"];

/** A model's trials, with confidence snapped to the same 6 levels players use (50, 60, ... 90, 99). */
export function modelTrials(m: AiModel): (Trial & { questionId: string })[] {
  const levels = [0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
  const snap = (c: number) => levels.reduce((best, l) => (Math.abs(l - c) < Math.abs(best - c) ? l : best), levels[0]);
  return Object.entries(m.answers).flatMap(([questionId, trials]) =>
    trials.map((t) => ({ questionId, correct: t.correct, confidence: snap(t.confidence) })),
  );
}

/** Per-question accuracy and mean confidence for one model. */
export function modelByQuestion(m: AiModel): Map<string, { acc: number; conf: number }> {
  const out = new Map<string, { acc: number; conf: number }>();
  for (const [qid, trials] of Object.entries(m.answers)) {
    if (!trials.length) continue;
    out.set(qid, {
      acc: trials.filter((t) => t.correct).length / trials.length,
      conf: trials.reduce((s, t) => s + t.confidence, 0) / trials.length,
    });
  }
  return out;
}
