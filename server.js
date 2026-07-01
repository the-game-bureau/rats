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
