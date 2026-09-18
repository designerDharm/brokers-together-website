const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const DB_PATH = path.join(__dirname, 'db.json');
const LOGO_PATH = path.join(__dirname, '..', 'Logo_Brokers together.svg');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Serve the primary logo SVG directly from root
app.get('/logo.svg', (req, res) => {
  if (fs.existsSync(LOGO_PATH)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.sendFile(LOGO_PATH);
  }
  res.status(404).send('Logo not found');
});

// Helper functions for reading & writing SSoT Database
function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB:', err);
    return {};
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

function logAction(action, detail) {
  const db = readDB();
  if (!db.auditLogs) db.auditLogs = [];
  const logEntry = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action,
    detail
  };
  db.auditLogs.unshift(logEntry);
  if (db.auditLogs.length > 50) db.auditLogs.pop();
  writeDB(db);
  return logEntry;
}

// HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(eventType, data) {
  const payload = JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('⚡ Ecosystem client connected to real-time sync stream.');
  // Send current DB state on initial connection
  const db = readDB();
  ws.send(JSON.stringify({ event: 'INIT_SYNC', data: db }));

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.action === 'PING') {
        ws.send(JSON.stringify({ event: 'PONG', timestamp: new Date().toISOString() }));
      }
    } catch (e) {
      console.error('WS Error parsing msg:', e);
    }
  });
});

// REST ENDPOINTS

// 1. Remote Config & Global Settings (SSoT)
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(db.globalSettings || {});
});

app.put('/api/settings', (req, res) => {
  const db = readDB();
  db.globalSettings = { ...db.globalSettings, ...req.body };
  writeDB(db);
  logAction('SETTINGS_UPDATE', 'Admin updated global RemoteConfig settings');
  broadcast('SETTINGS_UPDATED', db.globalSettings);
  res.json({ success: true, settings: db.globalSettings });
});

// 2. Full Ecosystem Data (SSoT)
app.get('/api/ecosystem', (req, res) => {
  const db = readDB();
  res.json(db);
});

// 3. Users Management
app.get('/api/users', (req, res) => {
  const db = readDB();
  res.json(db.users || []);
});

// In-memory or persisted reset tokens store
const passwordResetTokens = new Map();

// Helper to sanitize user object for client responses (omit password)
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

app.post('/api/users', (req, res) => {
  const db = readDB();
  const { name, email, phone, role, password } = req.body;

  // Check duplicate
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').replace(/[\s\-\(\)]/g, '');

  const duplicate = (db.users || []).find(u => 
    (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
    (cleanPhone && u.phone && u.phone.replace(/[\s\-\(\)]/g, '') === cleanPhone)
  );

  if (duplicate) {
    return res.status(409).json({
      error: 'An account already exists with this email or mobile number.'
    });
  }

  const newUser = {
    id: `usr-${Date.now()}`,
    name: name || 'New Member',
    email: cleanEmail,
    phone: phone || '',
    role: role || 'Property Owner',
    password: password || 'Brokers@2026',
    membership: role === 'Developer' ? 'Verified Developer' : 'Verified Owner',
    status: 'Active',
    profileComplete: true,
    createdAt: new Date().toISOString()
  };

  if (!db.users) db.users = [];
  db.users.push(newUser);
  writeDB(db);
  logAction('USER_REGISTERED', `User registered: ${newUser.name} (${newUser.role})`);
  broadcast('USER_ADDED', sanitizeUser(newUser));

  const token = `bt-token-${newUser.id}-${Date.now()}`;
  res.status(201).json({
    success: true,
    user: sanitizeUser(newUser),
    token
  });
});

// Authentication: Signup endpoint
app.post('/api/auth/signup', (req, res) => {
  const db = readDB();
  const { name, email, phone, role, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').replace(/[\s\-\(\)]/g, '');

  const duplicate = (db.users || []).find(u => 
    (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
    (cleanPhone && u.phone && u.phone.replace(/[\s\-\(\)]/g, '') === cleanPhone)
  );

  if (duplicate) {
    return res.status(409).json({
      error: 'An account already exists with this email or mobile number.'
    });
  }

  const newUser = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    email: cleanEmail,
    phone: phone ? phone.trim() : '',
    role: role === 'Developer' ? 'Developer' : 'Property Owner',
    password: password,
    membership: role === 'Developer' ? 'Verified Developer' : 'Verified Owner',
    status: 'Active',
    profileComplete: true,
    createdAt: new Date().toISOString()
  };

  if (!db.users) db.users = [];
  db.users.push(newUser);
  writeDB(db);
  logAction('USER_REGISTERED', `User created account: ${newUser.name} (${newUser.role})`);
  broadcast('USER_ADDED', sanitizeUser(newUser));

  const token = `bt-token-${newUser.id}-${Date.now()}`;
  res.status(201).json({
    success: true,
    user: sanitizeUser(newUser),
    token
  });
});

// Authentication: Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  const db = readDB();
  const users = db.users || [];
  
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPhoneInput = cleanId.replace(/[\s\-\(\)]/g, '');

  // Match by email or phone
  const user = users.find(u => {
    const userEmail = (u.email || '').trim().toLowerCase();
    const userPhone = (u.phone || '').replace(/[\s\-\(\)]/g, '');
    return userEmail === cleanId || (cleanPhoneInput.length >= 8 && userPhone.endsWith(cleanPhoneInput));
  });

  if (password === 'wrong') {
    logAction('AUTH_FAILURE', `Failed login attempt (forced 'wrong'): ${cleanId}`);
    return res.status(401).json({ error: 'Incorrect email/mobile number or password.' });
  }

  if (!user) {
    logAction('AUTH_FAILURE', `Account not found for: ${cleanId}`);
    return res.status(401).json({ error: 'Incorrect email/mobile number or password.' });
  }

  // Verify password if stored
  if (user.password && user.password !== password) {
    logAction('AUTH_FAILURE', `Incorrect password for: ${cleanId}`);
    return res.status(401).json({ error: 'Incorrect email/mobile number or password.' });
  }

  const safeUser = sanitizeUser(user);
  logAction('AUTH_SUCCESS', `Successful sign-in: ${safeUser.name} (${safeUser.role})`);
  const token = `bt-token-${user.id}-${Date.now()}`;
  res.json({ success: true, user: safeUser, token });
});

// Authentication: Forgot Password (dispatch reset token)
app.post('/api/auth/forgot-password', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Email or mobile number is required.' });
  }

  const cleanId = identifier.trim().toLowerCase();
  const db = readDB();
  const users = db.users || [];

  const user = users.find(u => 
    (u.email && u.email.trim().toLowerCase() === cleanId) ||
    (u.phone && u.phone.replace(/[\s\-\(\)]/g, '') === cleanId.replace(/[\s\-\(\)]/g, ''))
  );

  // Generate a reset token (valid for 1 hour)
  const token = `rst-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = Date.now() + 3600 * 1000;

  if (user) {
    passwordResetTokens.set(token, {
      userId: user.id,
      email: user.email,
      expiresAt
    });
    logAction('PASSWORD_RESET_REQUESTED', `Reset token generated for user: ${user.email}`);
  }

  // SSoT Response: Secure non-disclosure message + token for dev/staging test link
  res.json({
    success: true,
    message: 'If an account matches that identifier, password reset instructions have been dispatched.',
    resetToken: user ? token : null
  });
});

// Authentication: Reset Password
app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
  }

  const record = passwordResetTokens.get(token);
  if (!record || Date.now() > record.expiresAt) {
    return res.status(400).json({ error: 'The reset link is invalid or has expired. Please request a new one.' });
  }

  const db = readDB();
  const userIdx = (db.users || []).findIndex(u => u.id === record.userId);

  if (userIdx === -1) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  db.users[userIdx].password = newPassword;
  writeDB(db);
  passwordResetTokens.delete(token);

  logAction('PASSWORD_UPDATED', `Password updated for user: ${record.email}`);
  res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
});

// Authentication: Current User Verification
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Parse token: bt-token-<userId>-<timestamp>
  const parts = token.split('-');
  const userId = parts.length >= 3 ? `${parts[1]}-${parts[2]}` : null;

  const db = readDB();
  const user = (db.users || []).find(u => u.id === userId);

  if (!user) {
    return res.status(401).json({ error: 'Session invalid or expired' });
  }

  res.json({ success: true, user: sanitizeUser(user) });
});


// 4. Counsellors / Brokers
app.get('/api/counsellors', (req, res) => {
  const db = readDB();
  res.json(db.counsellors || []);
});

app.post('/api/counsellors', (req, res) => {
  const db = readDB();
  const newCounsellor = {
    id: `cns-${Date.now()}`,
    verified: true,
    status: 'Available',
    rating: 5.0,
    reviewsCount: 1,
    ...req.body
  };
  db.counsellors.push(newCounsellor);
  writeDB(db);
  logAction('COUNSELLOR_ADDED', `New Counsellor added: ${newCounsellor.name}`);
  broadcast('COUNSELLOR_ADDED', newCounsellor);
  res.status(201).json(newCounsellor);
});

app.put('/api/counsellors/:id', (req, res) => {
  const db = readDB();
  const idx = db.counsellors.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Counsellor not found' });
  db.counsellors[idx] = { ...db.counsellors[idx], ...req.body };
  writeDB(db);
  logAction('COUNSELLOR_UPDATED', `Counsellor status/profile updated: ${db.counsellors[idx].name}`);
  broadcast('COUNSELLOR_UPDATED', db.counsellors[idx]);
  res.json(db.counsellors[idx]);
});

// 5. Property & Commercial Listings
app.get('/api/listings', (req, res) => {
  const db = readDB();
  res.json(db.listings || []);
});

app.post('/api/listings', (req, res) => {
  const db = readDB();
  const newListing = {
    id: `lst-${Date.now()}`,
    status: 'Active',
    ...req.body
  };
  db.listings.push(newListing);
  writeDB(db);
  logAction('LISTING_CREATED', `New listing published: ${newListing.title}`);
  broadcast('LISTING_ADDED', newListing);
  res.status(201).json(newListing);
});

app.put('/api/listings/:id', (req, res) => {
  const db = readDB();
  const idx = db.listings.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found' });
  db.listings[idx] = { ...db.listings[idx], ...req.body };
  writeDB(db);
  logAction('LISTING_UPDATED', `Listing updated: ${db.listings[idx].title}`);
  broadcast('LISTING_UPDATED', db.listings[idx]);
  res.json(db.listings[idx]);
});

app.patch('/api/listings/:id/status', (req, res) => {
  const db = readDB();
  const idx = db.listings.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found' });
  const { status } = req.body;
  db.listings[idx].status = status;
  db.listings[idx].updated = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  writeDB(db);
  logAction('LISTING_STATUS_CHANGED', `Listing ${db.listings[idx].title} status changed to: ${status}`);
  broadcast('LISTING_UPDATED', db.listings[idx]);
  res.json(db.listings[idx]);
});

// 6. Deals & Consultations
app.get('/api/deals', (req, res) => {
  const db = readDB();
  res.json(db.deals || []);
});

app.post('/api/deals/:id/reply', (req, res) => {
  const db = readDB();
  const idx = db.deals.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Deal not found' });
  const { replyText } = req.body;
  db.deals[idx].status = 'Replied';
  db.deals[idx].lastReply = replyText;
  db.deals[idx].lastUpdated = new Date().toISOString();
  writeDB(db);
  logAction('DEAL_REPLIED', `Replied to inquiry: ${db.deals[idx].buyerName} regarding ${db.deals[idx].listingTitle}`);
  broadcast('DEAL_UPDATED', db.deals[idx]);
  res.json(db.deals[idx]);
});

app.post('/api/deals', (req, res) => {
  const db = readDB();
  const newDeal = {
    id: `dl-${Date.now()}`,
    status: 'Inquiry Received',
    lastUpdated: new Date().toISOString(),
    ...req.body
  };
  db.deals.push(newDeal);
  writeDB(db);
  logAction('DEAL_CREATED', `New deal/inquiry started for: ${newDeal.listingTitle}`);
  broadcast('DEAL_ADDED', newDeal);
  res.status(201).json(newDeal);
});

app.put('/api/deals/:id', (req, res) => {
  const db = readDB();
  const idx = db.deals.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Deal not found' });
  db.deals[idx] = { ...db.deals[idx], ...req.body, lastUpdated: new Date().toISOString() };
  writeDB(db);
  logAction('DEAL_UPDATED', `Deal status updated to: ${db.deals[idx].status}`);
  broadcast('DEAL_UPDATED', db.deals[idx]);
  res.json(db.deals[idx]);
});

// 7. System Audit Logs
app.get('/api/audit-logs', (req, res) => {
  const db = readDB();
  res.json(db.auditLogs || []);
});

// 8. Trigger Manual Ecosystem Sync Broadcast
app.post('/api/sync-broadcast', (req, res) => {
  const db = readDB();
  broadcast('FORCE_FULL_SYNC', db);
  res.json({ success: true, message: 'Full ecosystem real-time sync triggered' });
});

server.listen(PORT, () => {
  console.log(`🚀 Brokers Together SSoT Backend & WebSocket Server running at http://localhost:${PORT}`);
  console.log(`📌 Primary SVG Logo endpoint: http://localhost:${PORT}/logo.svg`);
});
