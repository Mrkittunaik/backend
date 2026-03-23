const { Category, Banner, Settings } = require('../models/Other');

// Public
const getCategories = async (req, res) => { try { res.json(await Category.find({ active: true }).sort('name')); } catch { res.status(500).json({ error: 'Server error' }); } };
const getBanners = async (req, res) => { try { res.json(await Banner.find({ active: true }).populate('contentId', 'title slug posterImage bannerImage shortDescription year rating type duration trailerLink ageRating').sort('order')); } catch { res.status(500).json({ error: 'Server error' }); } };
const getSettings = async (req, res) => { try { let s = await Settings.findOne(); if (!s) s = await new Settings({}).save(); res.json(s); } catch { res.status(500).json({ error: 'Server error' }); } };

// Admin Categories
const adminGetCategories = async (req, res) => { try { res.json(await Category.find().sort('name')); } catch { res.status(500).json({ error: 'Server error' }); } };
const adminGetCategory = async (req, res) => { try { const c = await Category.findById(req.params.id); if (!c) return res.status(404).json({ error: 'Not found' }); res.json(c); } catch { res.status(500).json({ error: 'Server error' }); } };
const adminCreateCategory = async (req, res) => {
  try {
    const d = { ...req.body };
    if (d.active !== undefined) d.active = d.active === 'true';
    if (req.file) d.image = '/uploads/' + req.file.filename;
    res.json(await new Category(d).save());
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const adminUpdateCategory = async (req, res) => {
  try {
    const d = { ...req.body };
    if (d.active !== undefined) d.active = d.active === 'true';
    if (req.file) d.image = '/uploads/' + req.file.filename;
    const c = await Category.findByIdAndUpdate(req.params.id, d, { new: true });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const adminDeleteCategory = async (req, res) => { try { await Category.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch { res.status(500).json({ error: 'Server error' }); } };

// Admin Banners
const adminGetBanners = async (req, res) => { try { res.json(await Banner.find().populate('contentId', 'title').sort('order')); } catch { res.status(500).json({ error: 'Server error' }); } };
const adminGetBanner = async (req, res) => { try { const b = await Banner.findById(req.params.id); if (!b) return res.status(404).json({ error: 'Not found' }); res.json(b); } catch { res.status(500).json({ error: 'Server error' }); } };
const adminCreateBanner = async (req, res) => {
  try {
    const d = { ...req.body };
    if (d.active !== undefined) d.active = d.active === 'true';
    if (d.order !== undefined) d.order = parseInt(d.order) || 0;
    if (req.file) d.bannerImage = '/uploads/' + req.file.filename;
    if (!d.contentId || d.contentId === '') delete d.contentId;
    res.json(await new Banner(d).save());
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const adminUpdateBanner = async (req, res) => {
  try {
    const d = { ...req.body };
    if (d.active !== undefined) d.active = d.active === 'true';
    if (d.order !== undefined) d.order = parseInt(d.order) || 0;
    if (req.file) d.bannerImage = '/uploads/' + req.file.filename;
    if (!d.contentId || d.contentId === '') delete d.contentId;
    const b = await Banner.findByIdAndUpdate(req.params.id, d, { new: true });
    res.json(b);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const adminDeleteBanner = async (req, res) => { try { await Banner.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch { res.status(500).json({ error: 'Server error' }); } };

// Admin Settings
const adminUpdateSettings = async (req, res) => {
  try {
    const d = { ...req.body };
    ['allowDownload','allowComments','requireLoginToWatch','requireLoginToDownload','allowUserRegistration','maintenanceMode'].forEach(k => { if (d[k] !== undefined) d[k] = d[k] === 'true'; });
    if (typeof d.socialLinks === 'string') try { d.socialLinks = JSON.parse(d.socialLinks); } catch {}
    if (typeof d.seoData === 'string') try { d.seoData = JSON.parse(d.seoData); } catch {}
    if (typeof d.homeSections === 'string') try { d.homeSections = JSON.parse(d.homeSections); } catch {}
    if (req.files?.siteLogo?.[0]) d.siteLogo = '/uploads/' + req.files.siteLogo[0].filename;
    if (req.files?.favicon?.[0]) d.favicon = '/uploads/' + req.files.favicon[0].filename;
    let s = await Settings.findOne();
    if (s) { Object.assign(s, d); await s.save(); } else { s = await new Settings(d).save(); }
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getAdminNotifications = async (req, res) => { try { const { Notification } = require('../models/Other'); res.json(await Notification.find().sort({ sentAt: -1 }).limit(50)); } catch { res.status(500).json({ error: 'Server error' }); } };

module.exports = { getCategories, getBanners, getSettings, adminGetCategories, adminGetCategory, adminCreateCategory, adminUpdateCategory, adminDeleteCategory, adminGetBanners, adminGetBanner, adminCreateBanner, adminUpdateBanner, adminDeleteBanner, adminUpdateSettings, getAdminNotifications };
