# Automation (optional)

Turns content-ideas into a hands-off digest DM'd to Slack on a schedule. Skip this entirely if you just want to run `/content-ideas` interactively.

## What you get
- A **Slack DM digest** every N days (default 3).
- A **saved-links inbox**: DM any post URL to the bot → it's featured in the next digest.
- Runs **unattended** via macOS launchd.

## 1. Slack app (5 min)
1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest** → paste:
   ```yaml
   display_information:
     name: Content Digest
   oauth_config:
     scopes:
       bot: [chat:write, im:write, im:history, reactions:write]
   features:
     bot_user:
       display_name: Content Digest
       always_online: true
   ```
2. **Install to Workspace** → copy the **Bot User OAuth Token** (`xoxb-...`).
3. **App Home** → enable the **Messages Tab** and "Allow users to send messages" (so you can DM it).
4. Copy your Slack **member ID** (profile → ⋮ → Copy member ID, `U0...`).

## 2. Credentials
Create `~/.config/content-ideas/env` (or set `CONTENT_IDEAS_ENV_FILE` to point elsewhere):
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_DM_USER_ID=U0...
# optional: SLACK_INBOX_CHANNEL=C0...   # use a channel instead of the DM
```

## 3. Configure the runner
Edit the CONFIG block at the top of `content-ideas-cron.sh` (paths to claude/node/python, `CONTENT_HOME`, your `PILLARS`, `MODEL`, `CADENCE_DAYS`). Test it:
```
bash automation/content-ideas-cron.sh
```
You should get a digest DM.

## 4. Schedule it (launchd)
1. Edit `com.example.content-ideas.plist` — set the absolute path to `content-ideas-cron.sh` and your log paths; adjust the hour.
2. Copy it to `~/Library/LaunchAgents/` and load:
   ```
   launchctl load -w ~/Library/LaunchAgents/com.example.content-ideas.plist
   ```
3. Force a test run any time:
   ```
   launchctl kickstart -k gui/$(id -u)/com.example.content-ideas
   ```

## Gotchas
- **Full Disk Access:** a launchd job can't read `~/Desktop`/`~/Documents` without granting Full Disk Access to `/bin/bash` (System Settings → Privacy & Security). Simplest fix: keep `CONTENT_HOME` and the scripts *outside* those folders.
- **launchd has no PATH** and doesn't read shell profiles — that's why the CONFIG block uses absolute paths.
- The leaked-token rule: never paste your `xoxb-` token anywhere public; rotate it if you do.
