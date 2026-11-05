"""Ask an AI model every Calibrate Me question, with a confidence rating, the same way people answer.

    GEMINI_API_KEY=... python scripts/ask_ai.py --model gemini-3.8-flash
    ANTHROPIC_API_KEY=... python scripts/ask_ai.py --model claude-sonnet-5-5

Model names starting with "gemini" use the Gemini API (a free Google AI Studio key
works); names starting with "claude" use the Anthropic API. Each question is asked
twice, once with the options swapped, so a preference for "the first option" can't
masquerade as knowledge. Results are merged into src/data/ai-answers.json, one entry
per model, so several models can be compared with people on the same page.
Uses only the Python standard library.
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PROMPT = """Answer this two-choice question, then say how confident you are that your answer is correct, as a percentage from 50 (pure guess) to 100 (certain).

Question: {q}
A) {a}
B) {b}

Reply in exactly this format:
ANSWER: A or B
CONFIDENCE: a number from 50 to 100"""


def _post(url: str, body: dict, headers: dict) -> dict:
    data = json.dumps(body).encode()
    for attempt in range(6):
        req = urllib.request.Request(url, data=data, headers={"content-type": "application/json", **headers})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            # Free-tier keys hit per-minute limits often; wait it out.
            if e.code in (429, 500, 503, 529) and attempt < 5:
                time.sleep(min(60, 4 * 2 ** attempt))
                continue
            raise


def provider(model: str) -> str:
    if model.startswith("gemini"):
        return "Google"
    if model.startswith("claude"):
        return "Anthropic"
    raise SystemExit(f"don't know which API serves {model!r}; use a gemini-* or claude-* model")


def ask(model: str, prompt: str) -> str:
    if provider(model) == "Google":
        r = _post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                  {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                   "generationConfig": {"temperature": 0, "maxOutputTokens": 1024,
                                        "thinkingConfig": {"thinkingLevel": "low"}}},
                  {"x-goog-api-key": os.environ["GEMINI_API_KEY"]})
        parts = ((r.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
        return "".join(p.get("text", "") for p in parts if not p.get("thought"))
    r = _post("https://api.anthropic.com/v1/messages",
              {"model": model, "max_tokens": 50, "temperature": 0, "messages": [{"role": "user", "content": prompt}]},
              {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01"})
    return "".join(b.get("text", "") for b in r["content"])


def parse(text: str):
    a = re.search(r"ANSWER\s*:\s*\**\s*([AB])\b", text, re.IGNORECASE)
    c = re.search(r"CONFIDENCE\s*:\s*\**\s*(\d{2,3})", text, re.IGNORECASE)
    if not a or not c:
        return None
    conf = min(max(int(c.group(1)), 50), 100) / 100
    return (0 if a.group(1).upper() == "A" else 1), conf


METHOD = "each question asked twice (options swapped), temperature 0, verbal confidence 50-100"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.environ.get("AI_MODEL", "gemini-3.8-flash"))
    ap.add_argument("--out", default=str(ROOT / "src" / "data" / "ai-answers.json"))
    a = ap.parse_args()
    key_name = {"Google": "GEMINI_API_KEY", "Anthropic": "ANTHROPIC_API_KEY"}[provider(a.model)]
    if not os.environ.get(key_name):
        print(f"{key_name} is not set", file=sys.stderr)
        return 2
    questions = json.loads((ROOT / "src" / "data" / "questions.json").read_text())
    answers = {}
    for i, q in enumerate(questions, 1):
        trials = []
        for order in ((0, 1), (1, 0)):
            opts = [q["options"][o] for o in order]
            parsed = parse(ask(a.model, PROMPT.format(q=q["question"], a=opts[0], b=opts[1])))
            if parsed is None:
                continue
            pick, conf = parsed
            trials.append({"correct": order[pick] == q["correct"], "confidence": conf, "order": list(order)})
        print(f"{i}/{len(questions)} {q['id']}: {[(t['correct'], t['confidence']) for t in trials]}", file=sys.stderr)
        if trials:
            answers[q["id"]] = trials

    out_path = Path(a.out)
    data = json.loads(out_path.read_text()) if out_path.exists() else {}
    models = [m for m in data.get("models", []) if m["model"] != a.model]
    models.append({
        "model": a.model,
        "provider": provider(a.model),
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "answers": answers,
    })
    out_path.write_text(json.dumps({"method": METHOD, "models": models}, indent=1) + "\n")
    print(f"wrote {a.out} ({a.model}: {len(answers)} questions; {len(models)} models in file)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
