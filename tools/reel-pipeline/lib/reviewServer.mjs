// Serves one batch's review page on this machine (127.0.0.1 only) and turns
// its "Send to Claude" button into a headless Claude Code run of the
// finishing prompt (agents/finish-picks.md) - so feedback reaches Claude
// without a chat being open. The page polls /status to show progress and,
// when the run ends, Claude's reply and links to the finished reels.
//
// Started by `reels.mjs review <batch>`, which the daily scheduled run calls
// once the batch is ready. Exits on its own after a long idle spell.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.json': 'application/json',
};
const IDLE_EXIT_HOURS = 20;

/** Serves a file, honouring Range requests - browsers need them to seek inside a video. */
function sendFile(req, res, file) {
  const { size } = fs.statSync(file);
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  }
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

/**
 * @param {{
 *   batchDir:string, repoRoot:string, pipelineRoot:string, port:number,
 *   model:string, effort:string,
 *   dryRun?:boolean, // run a stand-in command instead of Claude (for checking the plumbing)
 * }} options
 * @returns {Promise<{url:string, server:http.Server}>}
 */
export function startReviewServer({ batchDir, repoRoot, pipelineRoot, port, model, effort, dryRun = false }) {
  const batch = path.basename(batchDir);
  const logDir = path.join(pipelineRoot, 'logs');
  const state = { status: 'idle', startedAt: null, finishedAt: null, reply: '', log: null };
  let idleTimer = null;
  const armIdleExit = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (state.status !== 'running') process.exit(0);
      else armIdleExit();
    }, IDLE_EXIT_HOURS * 3600 * 1000);
  };

  function runFinisher(message) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.mkdirSync(path.join(batchDir, 'feedback'), { recursive: true });
    fs.writeFileSync(path.join(batchDir, 'feedback', `${stamp}.md`), message + '\n');
    fs.mkdirSync(logDir, { recursive: true });
    const log = path.join(logDir, `${batch}-finish-${stamp}.log`);

    const prompt = [
      fs.readFileSync(path.join(pipelineRoot, 'agents', 'finish-picks.md'), 'utf8'),
      '',
      'You are running unattended: nobody can answer questions. Where something is ambiguous, make the most reasonable call and say what you decided in your reply.',
      '',
      `The batch folder is tools/reel-pipeline/batches/${batch}. Andrei's message, sent from the review page:`,
      '',
      message,
    ].join('\n');

    const command = dryRun
      ? `node -e "process.stdin.pipe(process.stdout)"`
      : `claude -p --model ${model} --effort ${effort} --permission-mode acceptEdits --allowedTools Read Write Edit Glob Grep "Bash(node tools/reel-pipeline/reels.mjs:*)"`;
    const child = spawn(command, { cwd: repoRoot, shell: true, windowsHide: true });
    const out = fs.createWriteStream(log);
    let reply = '';
    child.stdout.on('data', (chunk) => {
      reply += chunk;
      out.write(chunk);
    });
    child.stderr.on('data', (chunk) => out.write(chunk));
    child.stdin.end(prompt);
    Object.assign(state, { status: 'running', startedAt: Date.now(), finishedAt: null, reply: '', log });
    child.on('close', (code) => {
      out.end();
      Object.assign(state, { status: code === 0 ? 'done' : 'failed', finishedAt: Date.now(), reply: reply.trim() || `(no reply - exit code ${code}; see ${log})` });
    });
  }

  const server = http.createServer((req, res) => {
    armIdleExit();
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'POST' && url.pathname === '/send') {
      if (state.status === 'running') return json(res, 409, { error: 'Claude is still working on the last message - wait for it to finish.' });
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const message = String(JSON.parse(body || '{}').message ?? '').trim();
        if (!message) return json(res, 400, { error: 'Empty message.' });
        runFinisher(message);
        json(res, 200, { ok: true });
      });
      return;
    }

    if (url.pathname === '/status') {
      const finalDir = path.join(batchDir, 'final');
      const finals = fs.existsSync(finalDir) ? fs.readdirSync(finalDir).filter((name) => name.endsWith('.mp4')) : [];
      return json(res, 200, { ...state, finals });
    }

    // Static files from the batch folder.
    const file = path.resolve(batchDir, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(batchDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    sendFile(req, res, file);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      armIdleExit();
      resolve({ url: `http://localhost:${server.address().port}/`, server });
    });
  });
}
