const express  = require('express');
const path     = require('path');
const cors     = require('cors');
const dotenv   = require('dotenv');
dotenv.config();

const { connectDB, disconnectDB, getStatus, loadSavedUri } = require('./config/db');
const { adminAuth, userAuth, upload } = require('./middleware/index');
const C = require('./controllers/index');

const app = express();

// ── CORS ──────────────────────────────────────────────────────
const ALLOWED = (process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin:(origin,cb)=>{
    if(!origin)return cb(null,true);
    if(ALLOWED.length&&!ALLOWED.includes('*')){
      if(ALLOWED.includes(origin)||/\.netlify\.app$/.test(origin)||/\.render\.com$/.test(origin))return cb(null,true);
    }
    return cb(null,true); // open CORS - tighten via ALLOWED_ORIGINS
  },
  credentials:true
}));
app.use(express.json());
app.use(express.urlencoded({extended:true}));

const fs = require('fs');
const publicDir = path.join(__dirname,'../public');
if(fs.existsSync(publicDir)){
  app.use(express.static(publicDir));
  app.use('/uploads',express.static(path.join(publicDir,'uploads')));
}

// ── DB guard ──────────────────────────────────────────────────
const requireDB=(req,res,next)=>{
  if(!getStatus().connected)return res.status(503).json({error:'Database not connected'});
  next();
};

// ── Auth for setup ────────────────────────────────────────────
const setupOrAdminAuth=(req,res,next)=>{
  const t=req.header('Authorization')?.replace('Bearer ','');
  if(!t)return res.status(401).json({error:'No token'});
  try{
    const jwt=require('jsonwebtoken');
    const d=jwt.verify(t,process.env.JWT_SECRET||'admin_secret');
    if(d.role==='setup'||d.role==='admin'){req.admin=d;return next();}
    return res.status(403).json({error:'Not authorized'});
  }catch{return res.status(401).json({error:'Invalid token'});}
};

// ══ PUBLIC ENDPOINTS (no auth needed) ═══════════════════════

// Health check
app.get('/api/health',(_,res)=>res.json({
  ok:true, server:'online',
  database:getStatus().connected?'connected':'disconnected',
  dbName: getStatus().connected ? (process.env.MONGO_URI||'').split('/').pop()?.split('?')[0]||'ottverse' : null,
  timestamp:new Date().toISOString(),
  uptime:Math.floor(process.uptime()),
  version:'3.0.0',
  envConfigured:{
    mongo:!!(process.env.MONGO_URI||loadSavedUri()),
    setupPin:!!process.env.SETUP_PIN
  }
}));

// DB status (public - no auth)
app.get('/api/db/status',(_,res)=>res.json(getStatus()));

// System status (public)
app.get('/api/system/status',(_,res)=>{
  const st=getStatus();
  res.json({
    backend:'online',
    database:st.connected?'connected':'disconnected',
    dbUri:st.uri,
    hasSavedUri:st.hasSavedUri,
    uptime:Math.floor(process.uptime()),
    timestamp:new Date().toISOString()
  });
});

// Setup login (no DB needed)
app.post('/api/admin/setup-login',(req,res)=>{
  const {pin}=req.body;
  const SETUP_PIN=process.env.SETUP_PIN||'ottverse2025';
  if(!pin||pin!==SETUP_PIN)return res.status(401).json({error:'Invalid setup PIN. Check SETUP_PIN in your .env on Render.'});
  const jwt=require('jsonwebtoken');
  const token=jwt.sign({id:'setup',role:'setup'},process.env.JWT_SECRET,{expiresIn:'2h'});
  res.json({token,message:'Setup token issued'});
});

// DB connect (needs setup token)
app.post('/api/db/connect',setupOrAdminAuth,async(req,res)=>{
  const {uri}=req.body;
  if(!uri)return res.status(400).json({error:'URI required'});
  const ok=await connectDB(uri);
  if(ok){
    try{await C.createDefaultAdmin();}catch{}
    res.json({success:true,status:getStatus()});
  }else{
    res.status(500).json({error:'Connection failed. Check: 1) Password correct? 2) IP whitelisted in Atlas Network Access (add 0.0.0.0/0)'});
  }
});

app.post('/api/db/disconnect',setupOrAdminAuth,async(_,res)=>{
  await disconnectDB();res.json({success:true});
});

// ══ ADMIN ROUTES ═════════════════════════════════════════════
app.post('/api/admin/login',requireDB,C.adminLogin);
app.get('/api/admin/analytics',requireDB,adminAuth,C.getAnalytics);

// Admin system endpoints
app.get('/api/admin/system/stats',requireDB,adminAuth,async(req,res)=>{
  try{
    const Content=require('./models/Content');
    const User=require('./models/User');
    const Comment=require('./models/Comment');
    const Episode=require('./models/Episode');
    const [tc,tu,tco,te,byType,topContent,recentUsers,recentContent]=await Promise.all([
      Content.countDocuments(),
      User.countDocuments(),
      Comment.countDocuments(),
      Episode.countDocuments(),
      Content.aggregate([{$group:{_id:'$type',count:{$sum:1},views:{$sum:'$views'}}}]),
      Content.find().sort({views:-1}).limit(10).select('title type views rating posterImage slug published'),
      User.find().sort({createdAt:-1}).limit(10).select('name email createdAt isActive'),
      Content.find().sort({createdAt:-1}).limit(8).select('title type posterImage createdAt published')
    ]);
    const totalViews=await Content.aggregate([{$group:{_id:null,t:{$sum:'$views'}}}]);
    res.json({
      totalContent:tc,totalUsers:tu,totalComments:tco,totalEpisodes:te,
      totalViews:totalViews[0]?.t||0,
      byType,topContent,recentUsers,recentContent,
      dbStatus:getStatus(),
      serverUptime:Math.floor(process.uptime()),
      timestamp:new Date().toISOString()
    });
  }catch(e){res.status(500).json({error:e.message});}
});

// Users
app.get('/api/admin/users',requireDB,adminAuth,C.getUsers);
app.get('/api/admin/users/:id',requireDB,adminAuth,async(req,res)=>{
  try{
    const User=require('./models/User');
    const u=await User.findById(req.params.id)
      .select('-password')
      .populate('watchlist','title slug posterImage type')
      .populate('continueWatching.content','title slug posterImage type');
    if(!u)return res.status(404).json({error:'Not found'});
    res.json(u);
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/admin/users/:id/toggle',requireDB,adminAuth,C.toggleUser);
app.delete('/api/admin/users/:id',requireDB,adminAuth,C.deleteUser);

// Notifications
app.post('/api/admin/notifications',requireDB,adminAuth,C.sendNotification);
app.get('/api/admin/notifications',requireDB,adminAuth,C.getAdminNotifications);

// Comments
app.get('/api/admin/comments',requireDB,adminAuth,C.getAdminComments);
app.delete('/api/admin/comments/:id',requireDB,adminAuth,C.deleteComment);
app.put('/api/admin/comments/:id/approve',requireDB,adminAuth,C.approveComment);

// Content CRUD
app.get('/api/admin/content',requireDB,adminAuth,C.adminGetContent);
app.get('/api/admin/content/:id',requireDB,adminAuth,C.adminGetOneContent);
app.post('/api/admin/content',requireDB,adminAuth,upload.fields([{name:'posterImage'},{name:'bannerImage'}]),C.adminCreateContent);
app.put('/api/admin/content/:id',requireDB,adminAuth,upload.fields([{name:'posterImage'},{name:'bannerImage'}]),C.adminUpdateContent);
app.delete('/api/admin/content/:id',requireDB,adminAuth,C.adminDeleteContent);

// Episodes
app.get('/api/admin/content/:id/episodes',requireDB,adminAuth,C.adminGetEpisodes);
app.post('/api/admin/episodes',requireDB,adminAuth,upload.single('thumbnail'),C.adminCreateEpisode);
app.put('/api/admin/episodes/:id',requireDB,adminAuth,upload.single('thumbnail'),C.adminUpdateEpisode);
app.delete('/api/admin/episodes/:id',requireDB,adminAuth,C.adminDeleteEpisode);

// Categories
app.get('/api/admin/categories',requireDB,adminAuth,C.adminGetCategories);
app.get('/api/admin/categories/:id',requireDB,adminAuth,C.adminGetCategory);
app.post('/api/admin/categories',requireDB,adminAuth,upload.single('image'),C.adminCreateCategory);
app.put('/api/admin/categories/:id',requireDB,adminAuth,upload.single('image'),C.adminUpdateCategory);
app.delete('/api/admin/categories/:id',requireDB,adminAuth,C.adminDeleteCategory);

// Banners
app.get('/api/admin/banners',requireDB,adminAuth,C.adminGetBanners);
app.get('/api/admin/banners/:id',requireDB,adminAuth,C.adminGetBanner);
app.post('/api/admin/banners',requireDB,adminAuth,upload.single('bannerImage'),C.adminCreateBanner);
app.put('/api/admin/banners/:id',requireDB,adminAuth,upload.single('bannerImage'),C.adminUpdateBanner);
app.delete('/api/admin/banners/:id',requireDB,adminAuth,C.adminDeleteBanner);

// Settings
app.get('/api/admin/settings',requireDB,adminAuth,C.getSettings);
app.put('/api/admin/settings',requireDB,adminAuth,upload.fields([{name:'siteLogo'},{name:'favicon'}]),C.adminUpdateSettings);

// ══ USER ROUTES ═══════════════════════════════════════════════
app.post('/api/users/register',requireDB,C.userRegister);
app.post('/api/users/login',requireDB,C.userLogin);
app.get('/api/users/profile',requireDB,userAuth,C.getProfile);
app.put('/api/users/profile',requireDB,userAuth,upload.single('avatar'),C.updateProfile);
app.post('/api/users/watchlist/:contentId',requireDB,userAuth,C.toggleWatchlist);
app.post('/api/users/progress',requireDB,userAuth,C.updateProgress);
app.post('/api/users/comments',requireDB,userAuth,C.addComment);
app.get('/api/users/notifications',requireDB,userAuth,C.getUserNotifications);
app.put('/api/users/notifications/read',requireDB,userAuth,C.markNotifsRead);

// ══ PUBLIC CONTENT ════════════════════════════════════════════
app.get('/api/content/featured',requireDB,C.getFeatured);
app.get('/api/content/trending',requireDB,C.getTrending);
app.get('/api/content/latest',requireDB,C.getLatest);
app.get('/api/content/recommended',requireDB,C.getRecommended);
app.get('/api/content',requireDB,C.getAllContent);
app.get('/api/content/slug/:slug',requireDB,C.getContentBySlug);
app.get('/api/content/:contentId/episodes',requireDB,C.getEpisodesByContent);
app.get('/api/categories',requireDB,C.getCategories);
app.get('/api/banners',requireDB,C.getBanners);
app.get('/api/settings',C.getSettings);

// ══ CATCH-ALL ═════════════════════════════════════════════════
if(fs.existsSync(publicDir)){
  app.get('*',(req,res)=>{
    if(!req.path.startsWith('/api'))res.sendFile(path.join(publicDir,'index.html'));
    else res.status(404).json({error:'Not found'});
  });
}else{
  app.use((req,res)=>{
    if(req.path.startsWith('/api'))res.status(404).json({error:'Not found'});
    else res.json({message:'OTTVERSE API running. Frontend deployed separately.'});
  });
}

const PORT=process.env.PORT||5000;
app.listen(PORT,async()=>{
  console.log(`\n🚀 OTTVERSE API on port ${PORT}`);
  console.log(`🔑 SETUP_PIN configured: ${!!process.env.SETUP_PIN}`);
  console.log(`🌍 CORS origins: ${ALLOWED.join(', ')||'(all open)'}\n`);
  const saved=loadSavedUri();
  if(saved){
    console.log('🔄 Auto-connecting saved MongoDB URI...');
    const ok=await connectDB(saved);
    if(ok)try{await C.createDefaultAdmin();}catch{}
    else console.log('⚠️  Auto-connect failed. Use Connection Center to reconnect.');
  }else if(process.env.MONGO_URI){
    const ok=await connectDB(process.env.MONGO_URI);
    if(ok)try{await C.createDefaultAdmin();}catch{}
  }else{
    console.log('⚠️  No MONGO_URI set. Add it in Render Environment Variables.');
  }
});
