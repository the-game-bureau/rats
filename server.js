// The Very REEL Game Show — tiny zero-dependency RSVP backend.
// Serves the static site and records RSVPs to rsvps.csv.
//
// Run:  node server.js       (then open http://localhost:3000)
// Port: set PORT env var to override (default 3000).

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const CSV = path.join(ROOT, 'rsvps.csv');
const VENMO_SPOTS = 8; // first N affirmative replies get the Venmo link

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Ensure the CSV exists with a header row.
if (!fs.existsSync(CSV)) {
  fs.writeFileSync(CSV, 'timestamp,first_name,last_initial\n');
}

function csvField(value) {
  // Quote and escape per RFC 4180 so commas/quotes can't corrupt the file.
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function countRsvps() {
  const lines = fs.readFileSync(CSV, 'utf8').trim().split('\n');
  return Math.max(0, lines.length - 1); // minus header
}

// Parse a single RFC-4180 CSV line (handles quotes and escaped "").
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function parseRsvps() {
  const lines = fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).filter(Boolean);
  return lines.map(parseCsvLine).map(([timestamp, first, last]) => ({ timestamp, first, last }));
}

// Escape text for safe HTML output.
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// GET /list?key=... — private admin view of who has RSVP'd.
function handleList(req, res, query) {
  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (!ADMIN_KEY) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('RSVP list is locked. Set an ADMIN_KEY environment variable on the server (Render → Environment) to enable it.');
  }
  if (query.get('key') !== ADMIN_KEY) {
    res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Unauthorized. Add ?key=YOUR_ADMIN_KEY to the URL.');
  }

  const people = parseRsvps();

  if (query.get('format') === 'json') {
    return sendJson(res, 200, { count: people.length, spots: VENMO_SPOTS, people });
  }

  const rows = people.map((p, i) => {
    const n = i + 1;
    const venmo = n <= VENMO_SPOTS ? '<span class="v">VENMO</span>' : '';
    const when = esc((p.timestamp || '').replace('T', ' ').replace(/\..*/, '') + ' UTC');
    return `<tr><td>${n}</td><td>${esc(p.first)} ${esc(p.last)}</td><td>${when}</td><td>${venmo}</td></tr>`;
  }).join('');

  const body = people.length
    ? `<table><thead><tr><th>#</th><th>Name</th><th>When (UTC)</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p class="empty">No RSVPs yet.</p>';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>RSVP List</title><style>
body{font-family:"Courier New",monospace;background:#f4f1e8;color:#000;padding:20px;max-width:680px;margin:0 auto}
h1{text-transform:uppercase;border-bottom:4px solid #000;padding-bottom:8px}
.count{font-weight:900;margin:12px 0}
table{width:100%;border-collapse:collapse;border:4px solid #000;background:#fff}
th,td{border:2px solid #000;padding:8px 10px;text-align:left;font-size:.95rem}
th{background:#000;color:#ffe600;text-transform:uppercase;font-size:.72rem;letter-spacing:1px}
.v{background:#ffe600;padding:1px 6px;font-weight:900;font-size:.7rem}
.empty{border:4px solid #000;background:#ffe600;padding:16px;font-weight:900;text-transform:uppercase}
.note{margin-top:16px;font-size:.8rem;opacity:.7}
</style></head><body>
<h1>RSVP List</h1>
<p class="count">${people.length} RSVP${people.length === 1 ? '' : 's'} · first ${VENMO_SPOTS} get the Venmo link</p>
${body}
<p class="note">Yellow VENMO tag = made the first ${VENMO_SPOTS}. Add &format=json for raw data.</p>
</body></html>`;

  setCors(res);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// Allow the GitHub Pages site (a different origin) to POST here.
// Set ALLOW_ORIGIN to your Pages URL to lock it down, e.g.
//   ALLOW_ORIGIN=https://you.github.io  node server.js
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  setCors(res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function handleRsvp(req, res) {
  let raw = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 10_000) {
      tooBig = true;
      req.destroy();
    }
  });
  req.on('end', () => {
    if (tooBig) return; // connection already torn down

    let first, last;
    try {
      const data = JSON.parse(raw || '{}');
      first = String(data.first || '').trim();
      last = String(data.last || '').trim();
    } catch {
      return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
    }

    if (!first || !last) {
      return sendJson(res, 400, { ok: false, error: 'First name and last initial are required.' });
    }

    // Normalize: keep last initial to a single letter.
    last = last.slice(0, 1).toUpperCase();

    const row = [csvField(new Date().toISOString()), csvField(first), csvField(last)].join(',') + '\n';
    try {
      fs.appendFileSync(CSV, row);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: 'Could not save your RSVP. Try again.' });
    }

    const count = countRsvps();
    const spotsLeft = Math.max(0, VENMO_SPOTS - count);
    const getsVenmo = count <= VENMO_SPOTS;

    sendJson(res, 200, {
      ok: true,
      name: first + ' ' + last,
      count,
      spotsLeft,
      getsVenmo,
    });
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Prevent path traversal — resolve and confirm it stays under ROOT.
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
}

const server = http.createServer((req, res) => {
  // CORS preflight from the browser before a cross-origin POST.
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'POST' && req.url === '/rsvp') {
    return handleRsvp(req, res);
  }
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/list') {
    return handleList(req, res, url.searchParams);
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`The Very REEL Game Show RSVP server running at http://localhost:${PORT}`);
  console.log(`RSVPs are saved to: ${CSV}`);
});
