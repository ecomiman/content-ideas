#!/bin/bash
# content-ideas daily digest runner (headless). Invoked by launchd or by hand.
# Pulls links you saved to the Slack bot, runs the skill unattended, composes a
# digest, and DMs it to you. Runs at most once every CADENCE_DAYS.
#
# launchd provides no shell PATH and does not read project env files, so set
# everything explicitly in the CONFIG block below.
set -uo pipefail

# ======================= CONFIG — EDIT THESE =======================
CLAUDE="$HOME/.local/bin/claude"            # output of: which claude
NODE="/opt/homebrew/bin/node"               # output of: which node
PYTHON="/usr/bin/python3"                    # output of: which python3
SKILL_DIR="$HOME/.claude/plugins/cache/content-ideas/content-ideas/2.2.0/skills/content-ideas"  # where scrape.py lives
CONTENT_HOME="$HOME/.config/content-ideas/data"   # brand/ + research/ live here
DIGEST_SPEC="$CONTENT_HOME/DIGEST-SPEC.md"        # your digest spec (optional)
PILLARS="pillar one, pillar two, pillar three"    # your content pillars
MODEL="claude-sonnet-5"                      # sonnet=balanced, claude-haiku-4-5=cheapest, opus=max quality
CADENCE_DAYS=3                               # run at most once every N days
# ==================================================================

AUTOMATION_DIR="$(cd "$(dirname "$0")" && pwd)"
SENDER="$AUTOMATION_DIR/slack-digest-send.mjs"
INBOX="$AUTOMATION_DIR/slack-inbox-read.mjs"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"
export CONTENT_HOME

LOG_DIR="$HOME/Library/Logs"
mkdir -p "$LOG_DIR"
RUN_LOG="$LOG_DIR/content-ideas-run.log"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
TODAY="$(date '+%Y-%m-%d')"
RUN_DIR="$CONTENT_HOME/research/$TODAY"
STATE_FILE="$LOG_DIR/content-ideas-last-run.txt"

log() { echo "[$STAMP] $*" >> "$RUN_LOG"; }
notify_fail() { "$NODE" "$SENDER" --text "Content digest failed: $1 (see $RUN_LOG)" >/dev/null 2>&1 || true; }

mkdir -p "$RUN_DIR"

# Cadence gate (macOS date -j): launchd fires daily; only run every CADENCE_DAYS.
if [ -f "$STATE_FILE" ]; then
  last_epoch="$(date -j -f '%Y-%m-%d' "$(cat "$STATE_FILE")" +%s 2>/dev/null || echo 0)"
  days_since=$(( ( $(date +%s) - last_epoch ) / 86400 ))
  if [ "$days_since" -lt "$CADENCE_DAYS" ]; then
    log "skipped — last run ${days_since}d ago (cadence: ${CADENCE_DAYS}d)"; exit 0
  fi
fi

log "run start"

# 1) Saved links: capture (dry-run) and pull via URL-mode. Ack only after success.
SAVED_URLS="$("$NODE" "$INBOX" --dry-run --quiet 2>>"$RUN_LOG")"
if [ -n "$SAVED_URLS" ]; then
  log "saved links: $(echo "$SAVED_URLS" | grep -c .)"
  # shellcheck disable=SC2086
  "$PYTHON" "$SKILL_DIR/scripts/scrape.py" urls $SAVED_URLS --pillars "$PILLARS" \
    > "$RUN_DIR/inbox-saved.json" 2>>"$RUN_LOG" \
    && log "inbox-saved.json written" \
    || { log "inbox fetch failed (continuing)"; rm -f "$RUN_DIR/inbox-saved.json"; }
else
  log "no saved links"; rm -f "$RUN_DIR/inbox-saved.json"
fi

# 2) Headless skill run.
PROMPT="/content-ideas

This is an unattended run. Do all of the following without asking, and do NOT open a browser, start a server, or send anything to Slack:
1. Run the full content-ideas flow and write feed-data.json for today's run folder.
2. Generate the feed in STATIC mode (generate_feed.py --static, no server, no browser).
3. If $RUN_DIR/inbox-saved.json exists and is non-empty, feature those as a 'Saved by you' section, weighted above competitor signal.
4. Compose the digest (Slack mrkdwn) leading with 'Saved by you' then prioritized next steps. If $DIGEST_SPEC exists, follow it.
5. Save the digest to $RUN_DIR/digest.md (overwrite if it exists).
Delivery is handled after you exit; just write digest.md."

"$CLAUDE" -p "$PROMPT" --model "$MODEL" --permission-mode bypassPermissions --output-format json >> "$RUN_LOG" 2>&1
if [ $? -ne 0 ]; then log "claude run failed"; notify_fail "headless run errored"; exit 1; fi
log "claude run ok"

# 3) Deliver.
DIGEST="$RUN_DIR/digest.md"
if [ ! -s "$DIGEST" ]; then log "no digest.md"; notify_fail "no digest produced"; exit 1; fi
"$NODE" "$SENDER" --file "$DIGEST" >> "$RUN_LOG" 2>&1 && log "digest sent" || { log "send failed"; exit 1; }

# 4) Ack saved links + advance cadence marker.
[ -n "$SAVED_URLS" ] && "$NODE" "$INBOX" --quiet >/dev/null 2>>"$RUN_LOG"
date '+%Y-%m-%d' > "$STATE_FILE"
log "run done"
