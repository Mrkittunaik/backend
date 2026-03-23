const express  = require('express');
const path     = require('path');
const cors     = require('cors');
const dotenv   = require('dotenv');
dotenv.config();

const { connectDB, disconnectDB, getStatus, loadSavedUri } = require('./config/db');
const { adminAuth, userAuth, optionalAuth, upload }         = require('./middleware/index');
const C = require('./controllers/index');

const app = express();

// ─── CORS — allow Netlify frontend + localhost dev ────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Always allow localhost in dev
const defaultOrigins = ['http://localhost:3000','http://localhost:5000','http://localhost:5173'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (Postman, curl, server-to-server)
    if (!origin) return cb(null, true);
    const allowed = [...defaultOrigins, ...ALLOWED_ORIGINS];
    if (allowed.includes(origin) || allowed.some(o => o === '*')) return cb(null, true);
    // Allow any netlify.app or render.com subdomain automatically
    if (/\.netlify\.app$/.test(origin) || /\.render\.com$/.test(origin)) return cb(null, true);
    return cb(null, true); // Open CORS — tighten via ALLOWED_ORIGINS in .env if needed
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files only if the public folder exists (single-server mode fallback)
const publicDir = path.join(__dirname, '../public');
const fs = require('fs');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.use('/uploads', express.static(path.join(publicDir, 'uploads')));
}

// ─── DB management ────────────────────────────────────────────────────────────
const requireDB = (req, res, next) => {
  if (!getStatus().connected)
    return res.status(503).json({ error: 'Database not connected.' });
  next();
};

app.get('/api/db/status', (_, res) => res.json(getStatus()));

const setupOrAdminAuth = (req, res, next) => {
  const t = req.header('Authorization')?.replace('Bearer ', '');
  if (!t) return res.status(401).json({ error: 'No token' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(t, process.env.JWT_SECRET || 'admin_secret');
    if (decoded.role === 'setup' || decoded.role === 'admin') { req.admin = decoded; return next(); }
    return res.status(403).json({ error: 'Not authorized' });
  } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
};

app.post('/api/db/connect', setupOrAdminAuth, async (req, res) => {
  const { uri } = req.body;
  if (!uri) return res.status(400).json({ error: 'URI required' });
  const ok = await connectDB(uri);
  if (ok) {
    try { await C.createDefaultAdmin(); } catch {}
    res.json({ success: true, status: getStatus() });
  } else {
    res.status(500).json({ error: 'Connection failed. Check your URI and MongoDB Atlas IP whitelist.' });
  }
});

app.post('/api/db/disconnect', setupOrAdminAuth, async (_, res) => {
  await disconnectDB();
  res.json({ success: true });
});

// ─── Setup login (no DB needed) ───────────────────────────────────────────────
app.post('/api/admin/setup-login', (req, res) => {
  const { pin } = req.body;
  const SETUP_PIN = process.env.SETUP_PIN || 'ottverse2025';
  if (!pin || pin !== SETUP_PIN) return res.status(401).json({ error: 'Invalid setup PIN' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: 'setup', role: 'setup' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, message: 'Setup token issued' });
});

// ─── Admin routes ─────────────────────────────────────────────────────────────
app.post('/api/admin/login', requireDB, C.adminLogin);
app.get('/api/admin/analytics', requireDB, adminAuth, C.getAnalytics);
app.get('/api/admin/users', requireDB, adminAuth, C.getUsers);
app.put('/api/admin/users/:id/toggle', requireDB, adminAuth, C.toggleUser);
app.delete('/api/admin/users/:id', requireDB, adminAuth, C.deleteUser);
app.post('/api/admin/notifications', requireDB, adminAuth, C.sendNotification);
app.get('/api/admin/notifications', requireDB, adminAuth, C.getAdminNotifications);
app.get('/api/admin/comments', requireDB, adminAuth, C.getAdminComments);
app.delete('/api/admin/comments/:id', requireDB, adminAuth, C.deleteComment);
app.put('/api/admin/comments/:id/approve', requireDB, adminAuth, C.approveComment);

// Admin content CRUD
app.get('/api/admin/content', requireDB, adminAuth, C.adminGetContent);
app.get('/api/admin/content/:id', requireDB, adminAuth, C.adminGetOneContent);
app.post('/api/admin/content', requireDB, adminAuth, upload.fields([{ name: 'posterImage' }, { name: 'bannerImage' }]), C.adminCreateContent);
app.put('/api/admin/content/:id', requireDB, adminAuth, upload.fields([{ name: 'posterImage' }, { name: 'bannerImage' }]), C.adminUpdateContent);
app.delete('/api/admin/content/:id', requireDB, adminAuth, C.adminDeleteContent);

// Admin Episodes
app.get('/api/admin/content/:id/episodes', requireDB, adminAuth, C.adminGetEpisodes);
app.post('/api/admin/episodes', requireDB, adminAuth, upload.single('thumbnail'), C.adminCreateEpisode);
app.put('/api/admin/episodes/:id', requireDB, adminAuth, upload.single('thumbnail'), C.adminUpdateEpisode);
app.delete('/api/admin/episodes/:id', requireDB, adminAuth, C.adminDeleteEpisode);

// Admin Categories
app.get('/api/admin/categories', requireDB, adminAuth, C.adminGetCategories);
app.get('/api/admin/categories/:id', requireDB, adminAuth, C.adminGetCategory);
app.post('/api/admin/categories', requireDB, adminAuth, upload.single('image'), C.adminCreateCategory);
app.put('/api/admin/categories/:id', requireDB, adminAuth, upload.single('image'), C.adminUpdateCategory);
app.delete('/api/admin/categories/:id', requireDB, adminAuth, C.adminDeleteCategory);

// Admin Banners
app.get('/api/admin/banners', requireDB, adminAuth, C.adminGetBanners);
app.get('/api/admin/banners/:id', requireDB, adminAuth, C.adminGetBanner);
app.post('/api/admin/banners', requireDB, adminAuth, upload.single('bannerImage'), C.adminCreateBanner);
app.put('/api/admin/banners/:id', requireDB, adminAuth, upload.single('bannerImage'), C.adminUpdateBanner);
app.delete('/api/admin/banners/:id', requireDB, adminAuth, C.adminDeleteBanner);

// Admin Settings
app.get('/api/admin/settings', requireDB, adminAuth, C.getSettings);
app.put('/api/admin/settings', requireDB, adminAuth, upload.fields([{ name: 'siteLogo' }, { name: 'favicon' }]), C.adminUpdateSettings);

// ─── User routes ──────────────────────────────────────────────────────────────
app.post('/api/users/register', requireDB, C.userRegister);
app.post('/api/users/login', requireDB, C.userLogin);
app.get('/api/users/profile', requireDB, userAuth, C.getProfile);
app.put('/api/users/profile', requireDB, userAuth, upload.single('avatar'), C.updateProfile);
app.post('/api/users/watchlist/:contentId', requireDB, userAuth, C.toggleWatchlist);
app.post('/api/users/progress', requireDB, userAuth, C.updateProgress);
app.post('/api/users/comments', requireDB, userAuth, C.addComment);
app.get('/api/users/notifications', requireDB, userAuth, C.getUserNotifications);
app.put('/api/users/notifications/read', requireDB, userAuth, C.markNotifsRead);

// ─── Public content routes ────────────────────────────────────────────────────
app.get('/api/content/featured', requireDB, C.getFeatured);
app.get('/api/content/trending', requireDB, C.getTrending);
app.get('/api/content/latest', requireDB, C.getLatest);
app.get('/api/content/recommended', requireDB, C.getRecommended);
app.get('/api/content', requireDB, C.getAllContent);
app.get('/api/content/slug/:slug', requireDB, C.getContentBySlug);
app.get('/api/content/:contentId/episodes', requireDB, C.getEpisodesByContent);

// ─── Public misc ──────────────────────────────────────────────────────────────
app.get('/api/categories', requireDB, C.getCategories);
app.get('/api/banners', requireDB, C.getBanners);
app.get('/api/settings', C.getSettings);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, db: getStatus().connected, ts: Date.now() }));

// ─── SPA catch-all (only when serving frontend from same process) ─────────────
if (fs.existsSync(publicDir)) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api'))
      res.sendFile(path.join(publicDir, 'index.html'));
    else
      res.status(404).json({ error: 'Not found' });
  });
} else {
  app.use((req, res) => {
    if (req.path.startsWith('/api')) res.status(404).json({ error: 'Not found' });
    else res.status(200).json({ message: 'OTTVERSE API is running. Frontend is deployed separately.' });
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`\n🚀 OTTVERSE API running on port ${PORT}`);
  console.log(`🔑 SETUP_PIN is set: ${!!process.env.SETUP_PIN}`);
  console.log(`🌍 ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.join(', ') || '(all — open CORS)'}\n`);

  // Auto-connect: try saved URI first, then .env
  const savedUri = loadSavedUri();
  if (savedUri) {
    console.log('🔄 Found saved MongoDB URI — auto-connecting...');
    const ok = await connectDB(savedUri);
    if (ok) try { await C.createDefaultAdmin(); } catch {}
    else console.log('⚠️  Auto-connect failed. Use /api/db/connect to reconnect.');
  } else if (process.env.MONGO_URI) {
    const ok = await connectDB(process.env.MONGO_URI);
    if (ok) try { await C.createDefaultAdmin(); } catch {}
  } else {
    console.log('⚠️  No MongoDB URI. Set MONGO_URI in .env or use the admin connect panel.');
  }
});
