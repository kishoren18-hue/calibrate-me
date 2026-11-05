"""Ask Claude every Calibrate Me question, with a confidence rating, the same way people answer.

    ANTHROPIC_API_KEY=... python scripts/ask_claude.py --model claude-sonnet-5-5

Each question is asked twice, once with the options swapped, so a preference for
"the first option" can't masquerade as knowledge. Writes src/data/claude-answers.json.
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


def ask(model: str, prompt: str, key: str) -> str:
    body = json.dumps({"model": model, "max_tokens": 50, "temperature": 0,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    for attempt in range(4):
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
            "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return "".join(b.get("text", "") for b in json.loads(r.read())["content"])
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 529) and attempt < 3:
                time.sleep(2 ** attempt * 2)
                continue
            raise


def parse(text: str):
    a = re.search(r"ANSWER\s*:\s*\**\s*([AB])\b", text, re.I)
    c = re.search(r"CONFIDENCE\s*:\s*\**\s*(\d{2,3})", text, re.I)
    if not a or not c:
        return None
    conf = min(max(int(c.group(1)), 50), 100) / 100
    return (0 if a.group(1).upper() == "A" else 1), conf


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5"))
    ap.add_argument("--out", default=str(ROOT / "src" / "data" / "claude-answers.json"))
    a = ap.parse_args()
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        print("ANTHROPIC_API_KEY is not set", file=sys.stderr)
        return 2
    questions = json.loads((ROOT / "src" / "data" / "questions.json").read_text())
    out = {}
    for i, q in enumerate(questions, 1):
        trials = []
        for order in ((0, 1), (1, 0)):
            opts = [q["options"][o] for o in order]
            parsed = parse(ask(a.model, PROMPT.format(q=q["question"], a=opts[0], b=opts[1]), key))
            if parsed is None:
                continue
            pick, conf = parsed
            trials.append({"correct": order[pick] == q["correct"], "confidence": conf, "order": list(order)})
        print(f"{i}/{len(questions)} {q['id']}: {[(t['correct'], t['confidence']) for t in trials]}", file=sys.stderr)
        if trials:
            out[q["id"]] = trials
    payload = {
        "model": a.model,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "method": "each question asked twice (options swapped), temperature 0, verbal confidence 50-100",
        "answers": out,
    }
    Path(a.out).write_text(json.dumps(payload, indent=1) + "\n")
    print(f"wrote {a.out} ({len(out)} questions)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
