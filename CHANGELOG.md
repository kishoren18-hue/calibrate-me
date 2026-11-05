# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-05

### Added

- Rebuilt as a Next.js 15 + TypeScript + Tailwind app
- Teacher accounts (email magic link), class codes and a live class dashboard
- Students join with a code and nickname; no student accounts or emails
- Humans vs. Claude page comparing anonymous aggregate player calibration with Claude's
- Supabase Postgres with row-level security, server-side scoring and hashed-IP rate limiting
- Database security tests in CI

## [0.2.0] - 2026-11-04

### Added

- Round lengths of 10, 20 or 40 questions
- Share links that carry only aggregate scores, plus a shared-result view
- Accessibility: labeled groups, pressed states, focus management, reduced motion
- Contributor docs and issue templates

## [0.1.0] - 2026-11-04

### Added

- Two-choice questions with confidence ratings, calibration chart, type-2 AUROC, Brier decomposition
- Per-browser history; deployed with GitHub Pages
