const express = require('express');
const path = require('path');
const fs = require('fs');

const rootDir = __dirname;

// 1. User Web App (Port 5051)
const userApp = express();
userApp.use('/shared', express.static(path.join(rootDir, 'shared')));
// Clean URL aliases
const cleanRoutes = [
  'login',
  'signup',
  'forgot-password',
  'reset-password',
  'onboarding',
  'dashboard',
  'new-project',
  'my-projects',
  'inquiries',
  'analytics',
  'settings'
];

cleanRoutes.forEach(r => {
  userApp.get(`/${r}`, (req, res) => res.sendFile(path.join(rootDir, 'user-app', `${r}.html`)));
});

userApp.use(express.static(path.join(rootDir, 'user-app')));
userApp.get('/Logo_Brokers%20together.svg', (req, res) => res.sendFile(path.join(rootDir, 'Logo_Brokers together.svg')));
userApp.listen(5051, () => {
  console.log('🌐 User Portal (Property Owners & Companies) running at http://localhost:5051');
});

// 2. Admin Panel (Port 5052)
const adminApp = express();
adminApp.use('/shared', express.static(path.join(rootDir, 'shared')));
adminApp.use(express.static(path.join(rootDir, 'admin-panel')));
adminApp.get('/Logo_Brokers%20together.svg', (req, res) => res.sendFile(path.join(rootDir, 'Logo_Brokers together.svg')));
adminApp.listen(5052, () => {
  console.log('⚙️ Admin Panel running at http://localhost:5052');
});
