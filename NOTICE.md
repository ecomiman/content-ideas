# NOTICE

This repository is an **extended fork** of
[bradautomates/content-ideas](https://github.com/bradautomates/content-ideas)
(MIT License, © Brad Automates). The base skill — its `SKILL.md`, scraper,
feed generator, and multi-surface packaging — is Brad's work and remains under
his MIT license (see `LICENSE`). Full credit to Brad Automates for the original.

## What this fork adds (© 2026 Iman Hamidi, MIT)

- `skills/content-ideas/scripts/lib/threads.py` — Threads fetcher (**new**)
- `skills/content-ideas/scripts/lib/linkedin.py` — LinkedIn keyword-search fetcher (**new**)
- `skills/content-ideas/scripts/lib/dates.py` — `parse_iso_date()` helper (**modified**)
- `skills/content-ideas/scripts/lib/platforms.py` — registers the two new fetchers (**modified**)
- `skills/content-ideas/scripts/lib/scoring.py` — comment/share-weighted scoring for LinkedIn/Threads + null-safe coercion (**modified**)
- `automation/` — a Slack-digest delivery + saved-links inbox + scheduled-run layer (**new**)
- `EXTENSIONS.md` — the added methodology and setup guide.

All additions are MIT-licensed under the same terms.
