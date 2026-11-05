import raw from "@/data/claude-answers.json";

import type { Trial } from "./stats";

type ClaudeTrial = { correct: boolean; confidence: number; order: number[] };
type ClaudeFile = { model: string | null; generated_at: string | null; method: string; answers: Record<string, ClaudeTrial[]> };

export const claude = raw as ClaudeFile;

/** Claude's trials, with confidence snapped to the same 6 levels players use (50, 60, ... 90, 99). */
export function claudeTrials(): (Trial & { questionId: string })[] {
  const levels = [0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
  const snap = (c: number) => levels.reduce((best, l) => (Math.abs(l - c) < Math.abs(best - c) ? l : best), levels[0]);
  return Object.entries(claude.answers).flatMap(([questionId, trials]) =>
    trials.map((t) => ({ questionId, correct: t.correct, confidence: snap(t.confidence) })),
  );
}
