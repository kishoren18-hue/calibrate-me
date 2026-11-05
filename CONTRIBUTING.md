# Contributing to calibrate-me

Thanks for your interest in improving calibrate-me. Bug reports, ideas, documentation fixes and code are all welcome.

## Getting set up

```bash
git clone https://github.com/kishoren18-hue/calibrate-me
cd calibrate-me
python3 -m http.server 8000     # then open http://localhost:8000
npm test                        # Node 20+
```

## Making a change

1. Open an issue first for anything larger than a small fix, so we can agree on the approach.
2. Create a branch, make the change, and add or update tests.
3. Keep pull requests focused on one thing; describe what changed and why.
4. Make sure the checks above pass, then open a pull request.

Good tests matter more than clever code here. A bug fix should come with a test that fails without the fix.

## Ideas to start with

* Add 20 more counterintuitive questions (with sources)
* Category filter (science, history, geography)
* Translate the interface

## Code of conduct

By participating you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).
