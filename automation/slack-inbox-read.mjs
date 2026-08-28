#!/usr/bin/env node
// Reads post links you DM'd the digest bot and prints them (one per line) so the
// runner can pull them via URL-mode. Tracks a cursor in CONTENT_HOME/inbox-state.json
// so a link is never processed twice, and (with reactions:write) checkmarks each.
// Set SLACK_INBOX_CHANNEL to read a channel instead of the DM.
// Env (process env or ~/.config/content-ideas/env): SLACK_BOT_TOKEN, SLACK_DM_USER_ID.
// Flags: --dry-run, --quiet.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SLACK_API = 'https://slack.com/api';
const ENV_FILE = process.env.CONTENT_IDEAS_ENV_FILE || path.join(os.homedir(), '.config', 'content-ideas', 'env');

function loadEnvFile(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  } catch {}
  return out;
}

function contentHome() {
  const o = (process.env.CONTENT_HOME || '').trim();
  return o ? o.replace(/^~/, os.homedir()) : path.join(os.homedir(), 'Documents', 'Content');
}

async function slack(method, token, body) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.error}`);
  return json;
}

function extractUrls(text) {
  const urls = new Set();
  const angle = /<(https?:\/\/[^|>]+)(?:\|[^>]*)?>/g;
  let m;
  while ((m = angle.exec(text))) urls.add(m[1]);
  const bare = /(?<![<|])\bhttps?:\/\/[^\s<>|]+/g;
  while ((m = bare.exec(text))) urls.add(m[0]);
  return [...urls];
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const quiet = args.has('--quiet');
  const note = (s) => { if (!quiet) process.stderr.write(s + '\n'); };

  const env = loadEnvFile(ENV_FILE);
  const token = process.env.SLACK_BOT_TOKEN || env.SLACK_BOT_TOKEN;
  const userId = process.env.SLACK_DM_USER_ID || env.SLACK_DM_USER_ID;
  const forcedChannel = process.env.SLACK_INBOX_CHANNEL || env.SLACK_INBOX_CHANNEL || null;
  if (!token) { console.error('SLACK_BOT_TOKEN missing.'); process.exit(2); }
  if (!userId && !forcedChannel) { console.error('SLACK_DM_USER_ID or SLACK_INBOX_CHANNEL required.'); process.exit(2); }

  let channel = forcedChannel;
  if (!channel) channel = (await slack('conversations.open', token, { users: userId })).channel.id;

  const stateFile = path.join(contentHome(), 'inbox-state.json');
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  const lastTs = state[channel]?.lastTs || '0';

  const messages = [];
  let cursor;
  do {
    const body = { channel, oldest: lastTs, limit: 200, inclusive: false };
    if (cursor) body.cursor = cursor;
    const page = await slack('conversations.history', token, body);
    messages.push(...(page.messages || []));
    cursor = page.response_metadata?.next_cursor || null;
  } while (cursor);

  const mine = messages.filter((m) => m.user === userId && !m.bot_id && !m.subtype);
  let newestTs = lastTs;
  const found = [];
  for (const m of mine) {
    if (m.ts > newestTs) newestTs = m.ts;
    for (const u of extractUrls(m.text || '')) found.push({ url: u, ts: m.ts });
  }

  const seen = new Set();
  const urls = [];
  for (const f of found) { if (!seen.has(f.url)) { seen.add(f.url); urls.push(f.url); } }
  for (const u of urls) console.log(u);

  note(`[inbox] channel=${channel} new-messages=${mine.length} urls=${urls.length}`);
  if (dryRun) { note('[inbox] dry-run: cursor not advanced'); return; }

  const acked = new Set();
  for (const m of mine) {
    if (acked.has(m.ts)) continue;
    acked.add(m.ts);
    try { await slack('reactions.add', token, { channel, timestamp: m.ts, name: 'white_check_mark' }); }
    catch (e) { if (!/already_reacted/.test(e.message)) note(`[inbox] react failed: ${e.message}`); }
  }

  if (newestTs !== lastTs) {
    state[channel] = { lastTs: newestTs, updated: new Date().toISOString() };
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  }
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
