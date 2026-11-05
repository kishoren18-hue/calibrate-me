# Contributing to calibrate-me

Thanks for your interest in improving calibrate-me. Bug reports, ideas, documentation fixes and code are all welcome.

## Getting set up

```bash
git clone https://github.com/kishoren18-hue/calibrate-me
cd calibrate-me
npm install                     # Node 20+
npm run dev                     # then open http://localhost:3000
```

Solo play works without any setup. Classes and the humans-vs-AI page need Supabase; copy `.env.example` to `.env.local` and see the README's Deploy section.

Run the checks CI runs:

```bash
npm test && npm run lint && npm run typecheck && npm run build
```

## Making a change

1. Open an issue first for anything larger than a small fix, so we can agree on the approach.
2. Create a branch, make the change, and add or update tests.
3. Keep pull requests focused on one thing; describe what changed and why.
4. Make sure the checks above pass, then open a pull request.

Good tests matter more than clever code here. A bug fix should come with a test that fails without the fix.

## Ideas to start with

Issues labeled [good first issue](https://github.com/kishoren18-hue/calibrate-me/labels/good%20first%20issue) are scoped for a first pull request. Other ideas:

* Translate the interface

## Code of conduct

By participating you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).
