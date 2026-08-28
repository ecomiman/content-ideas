#!/usr/bin/env node
// Sends a content-ideas digest as a Slack DM.
// Reads SLACK_BOT_TOKEN + SLACK_DM_USER_ID from the process env, falling back to
// ~/.config/content-ideas/env (or $CONTENT_IDEAS_ENV_FILE). Text comes from
// --text, --file <path>, or stdin. Long text is chunked and threaded.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SLACK_API = 'https://slack.com/api';
const ENV_FILE = process.env.CONTENT_IDEAS_ENV_FILE || path.join(os.homedir(), '.config', 'content-ideas', 'env');
const MAX_LEN = 3900;

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

function getConfig() {
  const fileEnv = loadEnvFile(ENV_FILE);
  return {
    token: process.env.SLACK_BOT_TOKEN || fileEnv.SLACK_BOT_TOKEN,
    user: process.env.SLACK_DM_USER_ID || fileEnv.SLACK_DM_USER_ID,
  };
}

function parseArgs(argv) {
  const args = { text: null, file: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--text') args.text = argv[++i];
    else if (a === '--file') args.file = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function chunkText(text, max) {
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if (line.length > max) {
      if (cur) { chunks.push(cur); cur = ''; }
      for (let i = 0; i < line.length; i += max) chunks.push(line.slice(i, i + max));
      continue;
    }
    if ((cur + '\n' + line).length > max && cur) { chunks.push(cur); cur = ''; }
    cur = cur ? cur + '\n' + line : line;
  }
  if (cur) chunks.push(cur);
  return chunks;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { token, user } = getConfig();
  let text = args.text;
  if (!text && args.file) text = fs.readFileSync(args.file, 'utf8');
  if (!text) text = await readStdin();
  text = (text || '').trim();
  if (!text) { console.error('No message text (use --text, --file, or stdin).'); process.exit(2); }
  if (!token) { console.error('SLACK_BOT_TOKEN not found.'); process.exit(2); }
  if (!user) { console.error('SLACK_DM_USER_ID not found.'); process.exit(2); }
  const chunks = chunkText(text, MAX_LEN);
  if (args.dryRun) {
    console.log(`[dry-run] would DM ${user} in ${chunks.length} message(s).`);
    console.log(text);
    return;
  }
  const open = await slack('conversations.open', token, { users: user });
  const channel = open.channel.id;
  let threadTs = null;
  for (const chunk of chunks) {
    const body = { channel, text: chunk, mrkdwn: true, unfurl_links: false, unfurl_media: false };
    if (threadTs) body.thread_ts = threadTs;
    const posted = await slack('chat.postMessage', token, body);
    if (!threadTs) threadTs = posted.ts;
  }
  console.log(`Sent ${chunks.length} message(s) to DM ${channel}.`);
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
