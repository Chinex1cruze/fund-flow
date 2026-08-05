const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const PORT = process.env.ADMIN_PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'admin_users.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', { encoding: 'utf8' });
}

function readUsers() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    return [];
  }
}

function writeUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function sha256Base64(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('base64');
}

function makeToken() {
  const buf = crypto.randomBytes(24);
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function serveStaticFile(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let requested = urlPath;
  if (requested === '/' || requested === '') requested = '/admin_create.html';
  const filePath = path.join(PUBLIC_DIR, requested.replace(/^\/+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.statusCode = 403; res.end('Forbidden'); return; }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) { res.statusCode = 404; res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const ct = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    fs.createReadStream(filePath).pipe(res);
  });
}

function escapeHtml(str){ return String(str).replace(/[&<>\"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]); }

function handleCreateAdmin(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.connection.destroy(); });
  req.on('end', () => {
    const parsed = querystring.parse(body);
    const username = (parsed.username || '').trim();
    const password = parsed.password || '';
    const passwordConfirm = parsed.passwordConfirm || '';
    if (!username || !password) { res.statusCode = 400; res.end('Username and password required'); return; }
    if (password !== passwordConfirm) { res.statusCode = 400; res.end('Password and confirmation do not match'); return; }
    const users = readUsers();
    if (users.find(u => u.username === username)) { res.statusCode = 400; res.end('User already exists'); return; }
    const salt = crypto.randomBytes(16).toString('base64');
    const passwordHash = sha256Base64(password + salt);
    const token = makeToken();
    const tokenHash = sha256Base64(token + salt);
    const user = { id: 'admin-' + Date.now(), username, passwordHash, salt, role: 'admin', tokenHash, tokenCreatedAt: new Date().toISOString() };
    users.push(user);
    writeUsers(users);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Admin Created</title></head><body><h1>Admin Created</h1><p>User <strong>${escapeHtml(username)}</strong> created with role <em>admin</em>.</p><p><strong>ONE-TIME TOKEN (copy now):</strong></p><pre style="background:#f5f5f5;padding:10px;border-radius:4px">${escapeHtml(token)}</pre><p>This token is shown only once. Store it securely (password manager). Use it to log in or as a Bearer token.</p><p><a href="/admin_verify_token.html">Verify token</a> | <a href="/admin_create.html">Create another admin</a></p></body></html>`);
  });
}

function handleVerifyToken(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.connection.destroy(); });
  req.on('end', () => {
    const parsed = querystring.parse(body);
    const token = parsed.token || '';
    if (!token) { res.statusCode = 400; res.end('Token required'); return; }
    const users = readUsers();
    let matched = null;
    for (const u of users) {
      const computed = sha256Base64(token + u.salt);
      if (computed === u.tokenHash) { matched = u; break; }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (matched) {
      res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Token Valid</title></head><body><h1>Token Valid</h1><p>Token belongs to user <strong>${escapeHtml(matched.username)}</strong> (role: ${escapeHtml(matched.role)}).</p><p>Created at: ${escapeHtml(matched.tokenCreatedAt)}</p><p><a href="/admin_create.html">Back</a></p></body></html>`);
    } else {
      res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Invalid Token</title></head><body><h1>Invalid Token</h1><p>The provided token is not valid.</p><p><a href="/admin_verify_token.html">Try again</a></p></body></html>`);
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET') { serveStaticFile(req, res); return; }
  if (req.method === 'POST' && req.url === '/create-admin') { handleCreateAdmin(req, res); return; }
  if (req.method === 'POST' && req.url === '/verify-token') { handleVerifyToken(req, res); return; }
  res.statusCode = 404; res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Admin server running on http://localhost:${PORT} — open /admin_create.html to create an admin`);
});
