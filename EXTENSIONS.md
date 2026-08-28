# Extensions to content-ideas

This fork keeps everything in [bradautomates/content-ideas](https://github.com/bradautomates/content-ideas) and adds three things: **more recency sources**, **smarter scoring**, and an **automation layer** that turns the skill into a hands-off daily (or every-N-days) digest delivered to Slack. See `NOTICE.md` for attribution.

---

## 1. New recency sources (LinkedIn + Threads)

### The problem this solves
ScrapeCreators' X endpoint (`/v1/twitter/user-tweets`) returns each account's **100 most-*popular*-ever tweets, not recent ones** — a documented limit of logged-out X scraping. So per-account X *recency is impossible*, and a feed built on X handles surfaces months-old content. **Don't treat X as a live source.**

### The fix
- **`linkedin.py`** — LinkedIn is **keyword-searched, not handle-tracked** (`/v1/linkedin/search/posts` is keyword-only). Each "tracked account" is a **topic lane** (query = pillar), and results come from whoever wrote them. This is the primary recency engine: it reaches the LinkedIn-primary voices that handle-tracking never could, and relevance is structural (the query *is* the pillar).
- **`threads.py`** — `/v1/threads/user/posts` returns a user's *recent* posts (unlike X), so Threads is a live per-creator source for the (few) niche creators active there.
- Both register in `platforms.py`; the pipeline dispatches them with no other changes. `dates.py` gains `parse_iso_date()` for LinkedIn's ISO timestamps.
- **For fresh X content**, save specific X post URLs to the Slack inbox (below) — URL-mode fetches them fresh, bypassing the popular-only timeline.

### Optional enhancement: per-platform recency windows
Long-form sources (YouTube) publish weekly-to-monthly, so a tight daily window drops them. A small change to `scrape.py` + `pipeline.py` (a `PLATFORM_MIN_DAYS` floor, e.g. `{"youtube": 45}`, that only *widens* a window and overrides `--since` for that platform) lets low-cadence lanes surface. Recommended if you track YouTube.

## 2. Comment/share-weighted scoring

`scoring.py` now weights **comments and shares** far above likes for LinkedIn (`likes + 4×comments`) and Threads (`likes + 3×replies + 2×reposts`). A post people *argued with or spread* is more idea-worthy than a high-like post nobody engaged — and on low-engagement LinkedIn, comments become the real discriminator. Also adds a `_n()` coercion helper: LinkedIn sometimes emits `likeCount: null`, which crashed the run with `TypeError: NoneType + int`; every platform branch is now null-safe.

## 3. Automation layer (`automation/`)

Turns the skill into a hands-off digest. **Nothing here is required** — the base skill runs interactively without it.

| File | What it does |
|---|---|
| `slack-digest-send.mjs` | DMs a composed digest to you on Slack (Slack mrkdwn, auto-chunked/threaded). |
| `slack-inbox-read.mjs` | Reads post links you DM'd the bot, prints them for URL-mode, ✓-acks them, tracks a cursor so nothing repeats. Your saved links become a top-priority "Saved by you" section. |
| `content-ideas-cron.sh` | The headless runner: pulls saved links → runs the skill unattended → composes the digest → DMs it. Gated to run at most every `CADENCE_DAYS`. Model is configurable (Sonnet ≈ balanced/cheap, Haiku = cheapest, Opus = max quality). |
| `com.example.content-ideas.plist` | macOS launchd job to fire the runner on a schedule. |

See `automation/README.md` for setup (Slack bot, env, launchd).

### Cost note
The unattended run's cost is dominated by the LLM step. On **Sonnet** it's roughly **$1–$1.50/run**; on **Haiku**, ~$0.25. Combined with an every-3-days cadence that's a few dollars a month. Keeping the run's working directory small (no giant `CLAUDE.md` in context) cuts it further.

---

## Key gotchas (carried from real use)

- **X is not a live source** — popular-only. Use LinkedIn/Threads for recency, saved-links for specific X posts.
- **LinkedIn is keyword-tracked** — lanes are queries, not people; competitors will appear, so apply any "don't cite competitors" rule at the *idea* stage, not the scrape stage.
- **Two-copy sync** (Claude Code) — the skill often runs from the *plugin-cache* copy, not your project copy; code edits must be synced there, and a plugin update reverts them.
- **macOS Full Disk Access** — a launchd job can't read `~/Desktop`/`~/Documents` without it; either grant it or keep the data + scripts elsewhere.
- **Carousel text isn't readable** — the scraper gets captions + engagement, not text baked into carousel images.
