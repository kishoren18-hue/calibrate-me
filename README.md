# Calibrate Me

[![tests](https://github.com/kishoren18-hue/calibrate-me/actions/workflows/pages.yml/badge.svg)](https://github.com/kishoren18-hue/calibrate-me/actions/workflows/pages.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A 20-question game that measures whether your confidence is honest.**

**▶ Play it: https://kishoren18-hue.github.io/calibrate-me/**

You answer two-choice questions and say how sure you are each time. At the end you see two things most people have never measured about themselves:

* **Calibration:** when you said 80%, were you right about 80% of the time?
* **Discrimination** (metacognitive sensitivity): were you more confident on the answers you got right than on the ones you got wrong?

These are the same measures cognitive scientists use to study confidence in people and that AI researchers use to check whether a language model knows when it's wrong. The game makes the idea concrete in about three minutes, and it's the most direct way I've found to explain why "the AI sounded sure" is not evidence.

| Question | Results |
|---|---|
| ![Question screen](docs/question.png) | ![Results screen](docs/results.png) |

*The results screenshot is from a scripted run with random answers, so the scores are bad on purpose.*

## What it measures

| Number | What it means |
|---|---|
| Overconfidence | Average confidence minus accuracy. Positive means you felt surer than you were. |
| Discrimination | Type-2 AUROC: the chance a random right answer got more confidence than a random wrong one. 0.5 means your confidence carried no information. |
| Brier score | Combined accuracy and calibration. Always answering 50% scores 0.25. |
| Calibration chart | Accuracy at each confidence level you used. Honest confidence sits on the diagonal. |
| Murphy decomposition | Brier = reliability − resolution + uncertainty, shown under "What these numbers mean". |

You can be perfectly calibrated with zero discrimination: say 70% on everything when you get 70% right. Good judgment needs both, which is why both are shown.

Sessions are saved in your browser only (localStorage), so you can see your overconfidence trend across rounds. Nothing is sent anywhere.

## Use in a classroom

It runs in any browser with no sign-in. A workshop flow that works:

1. Everyone plays one round and writes down their overconfidence number.
2. Talk about the most confident misses: why did those feel certain?
3. Play a second round and compare.
4. Connect it to AI: a chatbot's tone of certainty is a confidence signal too, and it can be just as miscalibrated.

## Run locally

It's plain HTML, CSS and ES modules with no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Tests (Node 20+):

```bash
npm test
```

The tests cover the scoring math (including that the Murphy decomposition adds back up to the Brier score) and check the question bank for malformed or duplicate rows.

## Adding questions

Questions live in `questions.js` as `[question, optionA, optionB, correctIndex, explanation]`. Good questions have one indisputable answer and a mix of difficulty; counterintuitive ones ("Which city is farther west: Los Angeles or Reno?") are the most useful because they produce confident mistakes. Option order is shuffled at play time.

## Why I built this

My research is on calibration in language models: whether a model's confidence matches its accuracy and whether it can tell its right answers from its wrong ones. I run AI literacy workshops for high school students, and explaining calibration in the abstract never landed. Letting people measure their own confidence first, then asking whether a chatbot's confidence deserves more trust, works much better. The metrics here are the same ones I use on models.

## License

MIT
