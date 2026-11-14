// Builds a batch's review page: every preview clip in a grid, a "pick" toggle
// and a note box on each, and a bar that turns the choices into a message to
// paste back to Claude. A single self-contained HTML file next to the clips,
// opened straight from disk - no server.

const escapeHtml = (text) => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {{batch:string, items:{id:string, title:string, archetype:string, palette:string, hook:string, seconds:number, video:string, poster:string, error?:string}[]}} manifest
 *   `video`/`poster` are paths relative to the page.
 * @returns {string} the page's HTML
 */
export function galleryHtml(manifest) {
  const tiles = manifest.items
    .map((item) => {
      if (item.error) {
        return `<article class="tile failed"><div class="frame"><p>${escapeHtml(item.id)} failed to render</p><pre>${escapeHtml(item.error)}</pre></div></article>`;
      }
      return `<article class="tile" data-id="${escapeHtml(item.id)}">
        <div class="frame">
          <video src="${escapeHtml(item.video)}" poster="${escapeHtml(item.poster)}" preload="none" loop playsinline></video>
          <span class="badge">${escapeHtml(item.id)}</span>
          <span class="length">${Math.round(item.seconds)}s</span>
          <button class="expand" type="button" title="Full screen (or double-click the clip)">Full screen</button>
        </div>
        <h2>${escapeHtml(item.title)}</h2>
        <p class="hook">${escapeHtml(item.hook)}</p>
        <label class="pick"><input type="checkbox"> <span>Pick this one</span></label>
        <input class="note" type="text" placeholder="Note for the edit (optional)">
      </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reels ${escapeHtml(manifest.batch)}</title>
<style>
  :root { --bg:#0d0d12; --panel:#17171f; --line:#2a2a36; --text:#ececf1; --muted:#9a9aa8; --accent:#ffd166; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.45 "Segoe UI",system-ui,sans-serif; padding:24px 24px 120px; }
  header { max-width:1500px; margin:0 auto 20px; }
  h1 { font-size:22px; margin:0 0 4px; }
  header p { margin:0; color:var(--muted); }
  .grid { max-width:1500px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:18px; }
  .tile { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:8px; }
  .tile.picked { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
  .frame { position:relative; aspect-ratio:9/16; background:#000; border-radius:8px; overflow:hidden; cursor:pointer; }
  .frame video { width:100%; height:100%; object-fit:cover; display:block; }
  .badge,.length { position:absolute; top:8px; background:rgba(0,0,0,.65); padding:2px 8px; border-radius:999px; font-size:12px; font-variant-numeric:tabular-nums; }
  .badge { left:8px; font-weight:700; } .length { right:8px; color:var(--muted); }
  h2 { font-size:14px; margin:0; overflow-wrap:anywhere; }
  .hook { margin:0; color:var(--muted); font-size:13px; min-height:2.9em; }
  .pick { display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600; }
  .pick input { width:18px; height:18px; accent-color:var(--accent); }
  .note { width:100%; background:var(--bg); color:var(--text); border:1px solid var(--line); border-radius:6px; padding:6px 8px; font:inherit; font-size:13px; }
  .expand { position:absolute; right:8px; bottom:8px; padding:5px 10px; font-size:12px; background:rgba(0,0,0,.7); color:var(--text); border:1px solid var(--line); border-radius:999px; }
  .expand:hover { border-color:var(--accent); }
  #viewer { position:fixed; inset:0; z-index:10; background:#000; display:none; align-items:center; justify-content:center; }
  #viewer.open { display:flex; }
  #viewer video { height:100vh; max-width:100vw; aspect-ratio:9/16; background:#000; }
  #viewer .side { position:absolute; left:24px; bottom:24px; max-width:min(320px, calc((100vw - 56.25vh) / 2 - 48px)); display:flex; flex-direction:column; gap:10px; }
  #viewer .side h2 { font-size:18px; }
  #viewer .keys { color:var(--muted); font-size:12px; }
  #viewer .close { position:absolute; top:16px; right:16px; }
  #viewer .nav { position:absolute; top:50%; transform:translateY(-50%); font-size:22px; padding:14px 18px; background:rgba(255,255,255,.08); color:var(--text); }
  #viewer .prev { left:16px; } #viewer .next { right:16px; }
  .failed pre { white-space:pre-wrap; font-size:11px; color:#ff8080; padding:8px; }
  .failed .frame { cursor:default; display:flex; flex-direction:column; justify-content:center; padding:8px; }
  footer { position:fixed; left:0; right:0; bottom:0; background:var(--panel); border-top:1px solid var(--line); padding:12px 24px; display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
  footer .summary { flex:1; min-width:200px; }
  footer textarea { flex:2; min-width:260px; height:58px; background:var(--bg); color:var(--text); border:1px solid var(--line); border-radius:6px; padding:6px 8px; font:13px/1.35 inherit; resize:vertical; }
  button { background:var(--accent); color:#111; border:0; border-radius:8px; padding:10px 16px; font:inherit; font-weight:700; cursor:pointer; }
  button:disabled { opacity:.4; cursor:default; }
  button.secondary { background:transparent; color:var(--text); border:1px solid var(--line); }
  #claude { display:none; max-width:1500px; margin:0 auto 20px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  #claude.shown { display:block; }
  #claude h2 { font-size:15px; margin:0 0 8px; }
  #claude pre { white-space:pre-wrap; font:13px/1.45 inherit; margin:8px 0 0; max-height:360px; overflow:auto; }
  #claude a { color:var(--accent); }
</style>
</head>
<body>
<header>
  <h1>Reels &middot; ${escapeHtml(manifest.batch)}</h1>
  <p>${manifest.items.length} candidates. Click a clip to play it with sound; "Full screen" (or a double-click) opens it large, and the arrow keys step through the batch. Tick the ones to post, add notes if you want changes, then press "Send to Claude" (or, with the page opened from disk, copy the message and paste it to Claude).</p>
</header>
<section id="claude"><h2 id="claudeTitle"></h2><div id="claudeFinals"></div><pre id="claudeReply"></pre></section>
<main class="grid">
${tiles}
</main>
<div id="viewer">
  <video controls loop playsinline></video>
  <button class="nav prev" type="button" title="Previous (left arrow)">&#8249;</button>
  <button class="nav next" type="button" title="Next (right arrow)">&#8250;</button>
  <button class="close" type="button">Close</button>
  <div class="side">
    <h2 id="viewerTitle"></h2>
    <label class="pick"><input id="viewerPick" type="checkbox"> <span>Pick this one</span></label>
    <div class="keys">Left / right: previous / next &middot; P: pick &middot; Space: play / pause &middot; Esc: close</div>
  </div>
</div>
<footer>
  <div class="summary" id="summary">Nothing picked yet.</div>
  <textarea id="general" placeholder="Anything else for tomorrow's batch? (more like 04, fewer captions, slower camera, ...)"></textarea>
  <button id="send" disabled hidden>Send to Claude</button>
  <button id="copy" disabled>Copy message for Claude</button>
</footer>
<script>
  const BATCH = ${JSON.stringify(manifest.batch)};
  const KEY = 'reel-picks-' + BATCH;
  const tiles = [...document.querySelectorAll('.tile[data-id]')];
  const summary = document.getElementById('summary');
  const general = document.getElementById('general');
  const copy = document.getElementById('copy');
  const send = document.getElementById('send');
  let claudeBusy = false;

  // Remembering half-made choices is a convenience only; the page works without it.
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}

  function state() {
    const picks = {};
    for (const tile of tiles) {
      const picked = tile.querySelector('.pick input').checked;
      const note = tile.querySelector('.note').value.trim();
      if (picked || note) picks[tile.dataset.id] = { picked, note };
    }
    return { picks, general: general.value.trim() };
  }

  function message() {
    const { picks, general: overall } = state();
    const chosen = Object.keys(picks).filter((id) => picks[id].picked);
    const lines = ['Finish reels from batch ' + BATCH + ': ' + (chosen.join(', ') || '(none)')];
    const notes = Object.entries(picks).filter(([, p]) => p.note);
    if (notes.length) {
      lines.push('Notes:');
      for (const [id, p] of notes) lines.push('- ' + id + (p.picked ? '' : ' (not picked)') + ': ' + p.note);
    }
    if (overall) lines.push('For next time: ' + overall);
    return lines.join('\\n');
  }

  function refresh() {
    const current = state();
    const chosen = Object.keys(current.picks).filter((id) => current.picks[id].picked);
    for (const tile of tiles) tile.classList.toggle('picked', tile.querySelector('.pick input').checked);
    summary.textContent = chosen.length ? 'Picked ' + chosen.length + ': ' + chosen.join(', ') : 'Nothing picked yet.';
    copy.disabled = chosen.length === 0 && !current.general && !Object.values(current.picks).some((p) => p.note);
    send.disabled = copy.disabled || claudeBusy;
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch {}
  }

  for (const tile of tiles) {
    const video = tile.querySelector('video');
    const before = saved.picks && saved.picks[tile.dataset.id];
    if (before) {
      tile.querySelector('.pick input').checked = !!before.picked;
      tile.querySelector('.note').value = before.note || '';
    }
    tile.querySelector('.frame').addEventListener('click', () => {
      if (video.paused) {
        for (const other of document.querySelectorAll('video')) if (other !== video) other.pause();
        video.play();
      } else {
        video.pause();
      }
    });
    tile.querySelector('.pick input').addEventListener('change', refresh);
    tile.querySelector('.note').addEventListener('input', refresh);
  }
  // Full-screen viewer: one clip filling the window's height, stepping through the batch with the arrow keys.
  const viewer = document.getElementById('viewer');
  const viewerVideo = viewer.querySelector('video');
  const viewerPick = document.getElementById('viewerPick');
  let viewing = -1;

  function show(index) {
    viewing = (index + tiles.length) % tiles.length;
    const tile = tiles[viewing];
    for (const other of document.querySelectorAll('.tile video')) other.pause();
    viewerVideo.src = tile.querySelector('video').getAttribute('src');
    viewerVideo.play().catch(() => {});
    document.getElementById('viewerTitle').textContent = tile.dataset.id + ' \u00b7 ' + tile.querySelector('h2').textContent;
    viewerPick.checked = tile.querySelector('.pick input').checked;
    viewer.classList.add('open');
    // Real full screen where the browser allows it; the overlay already fills the window if not.
    if (!document.fullscreenElement && viewer.requestFullscreen) viewer.requestFullscreen().catch(() => {});
  }

  function hide() {
    viewer.classList.remove('open');
    viewerVideo.pause();
    viewing = -1;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function togglePickInViewer() {
    const box = tiles[viewing].querySelector('.pick input');
    box.checked = !box.checked;
    viewerPick.checked = box.checked;
    refresh();
  }

  tiles.forEach((tile, index) => {
    tile.querySelector('.expand').addEventListener('click', (event) => {
      event.stopPropagation();
      show(index);
    });
    tile.querySelector('.frame').addEventListener('dblclick', () => show(index));
  });
  viewer.querySelector('.close').addEventListener('click', hide);
  viewer.querySelector('.prev').addEventListener('click', () => show(viewing - 1));
  viewer.querySelector('.next').addEventListener('click', () => show(viewing + 1));
  viewerPick.addEventListener('change', togglePickInViewer);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && viewing !== -1) hide(); // Esc in real full screen leaves it; close the viewer with it
  });
  document.addEventListener('keydown', (event) => {
    if (viewing === -1) return;
    if (event.key === 'Escape') hide();
    else if (event.key === 'ArrowLeft') show(viewing - 1);
    else if (event.key === 'ArrowRight') show(viewing + 1);
    else if (event.key === 'p' || event.key === 'P') togglePickInViewer();
    else if (event.key === ' ') {
      event.preventDefault();
      if (viewerVideo.paused) viewerVideo.play();
      else viewerVideo.pause();
    }
  });

  general.value = saved.general || '';
  general.addEventListener('input', refresh);

  // Opened through "reels.mjs review" (http://localhost), the page can hand the
  // message straight to a headless Claude run. Opened from disk it cannot,
  // and copying the message to paste by hand is the way.
  if (location.protocol.startsWith('http') && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    send.hidden = false;
    copy.classList.add('secondary');
    const panel = document.getElementById('claude');
    const title = document.getElementById('claudeTitle');
    const reply = document.getElementById('claudeReply');
    const finals = document.getElementById('claudeFinals');
    const poll = async () => {
      let status;
      try { status = await (await fetch('/status')).json(); } catch { return; }
      claudeBusy = status.status === 'running';
      if (status.status !== 'idle') {
        panel.classList.add('shown');
        const minutes = Math.round((Date.now() - status.startedAt) / 60000);
        title.textContent = {
          running: 'Claude is finishing your reels... (' + minutes + ' min so far - usually 5 to 15; you can close this page)',
          done: 'Claude is done.',
          failed: 'Claude stopped with an error - see the reply below and the log.',
        }[status.status];
        reply.textContent = status.status === 'running' ? '' : status.reply;
        finals.innerHTML = status.finals.length
          ? 'Finished reels: ' + status.finals.map((name) => '<a href="final/' + encodeURIComponent(name) + '" target="_blank">' + name + '</a>').join(' &middot; ')
          : '';
      }
      refresh();
      setTimeout(poll, claudeBusy ? 4000 : 15000);
    };
    poll();
    send.addEventListener('click', async () => {
      send.disabled = true;
      const response = await fetch('/send', { method: 'POST', body: JSON.stringify({ message: message() }) });
      if (!response.ok) alert((await response.json()).error);
      poll();
    });
  }

  copy.addEventListener('click', async () => {
    const text = message();
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
    } catch {
      // Clipboard access can be refused for a page opened from disk - fall back to showing the text to copy by hand.
      general.value = text;
      general.select();
      copy.textContent = 'Select all + copy from the box';
    }
    setTimeout(() => (copy.textContent = 'Copy message for Claude'), 2500);
  });
  refresh();
</script>
</body>
</html>
`;
}
