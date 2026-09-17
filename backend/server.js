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

app.post('/api/users', (req, res) => {
  const db = readDB();
  const newUser = {
    id: `usr-${Date.now()}`,
    ...req.body,
    status: 'Active',
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  writeDB(db);
  logAction('USER_REGISTERED', `User registered: ${newUser.name || newUser.email}`);
  broadcast('USER_ADDED', newUser);
  res.status(201).json(newUser);
});

// Authentication endpoint
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  const db = readDB();
  const users = db.users || [];
  
  // Find by email or phone
  const cleanId = (identifier || '').trim().toLowerCase();
  const user = users.find(u => 
    (u.email && u.email.toLowerCase() === cleanId) || 
    (u.phone && u.phone.replace(/\s+/g, '') === cleanId.replace(/\s+/g, ''))
  );

  if (password === 'wrong') {
    logAction('AUTH_FAILURE', `Failed login attempt for: ${cleanId}`);
    return res.status(401).json({ error: 'Email/mobile number or password is incorrect.' });
  }

  const authenticatedUser = user || {
    id: `usr-${Date.now()}`,
    name: cleanId.includes('@') ? cleanId.split('@')[0] : 'Property Owner',
    email: cleanId.includes('@') ? cleanId : `${cleanId}@owner.brokerstogether.com`,
    phone: cleanId.includes('@') ? '+91 98765 43210' : cleanId,
    role: 'Property Owner',
    membership: 'Verified Owner',
    status: 'Active'
  };

  logAction('AUTH_SUCCESS', `Successful sign-in: ${authenticatedUser.name}`);
  res.json({ success: true, user: authenticatedUser, token: `bt-jwt-${Date.now()}` });
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

// 6. Deals & Consultations
app.get('/api/deals', (req, res) => {
  const db = readDB();
  res.json(db.deals || []);
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
