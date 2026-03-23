const Content = require('../models/Content');
const Episode = require('../models/Episode');
const Comment = require('../models/Comment');

const processBody = (b, files) => {
  const d = { ...b };
  ['cast','genres','subtitles'].forEach(k => { if (typeof d[k] === 'string') d[k] = d[k].split(',').map(s => s.trim()).filter(Boolean); });
  ['featured','trending','recommended','latest','published'].forEach(k => { if (d[k] !== undefined) d[k] = d[k] === 'true' || d[k] === true; });
  if (typeof d.videoServers === 'string') try { d.videoServers = JSON.parse(d.videoServers); } catch { d.videoServers = []; }
  if (typeof d.downloadLinks === 'string') try { d.downloadLinks = JSON.parse(d.downloadLinks); } catch { d.downloadLinks = []; }
  if (typeof d.seo === 'string') try { d.seo = JSON.parse(d.seo); } catch { d.seo = {}; }
  if (!d.category || d.category === '') delete d.category;
  if (d.rating !== undefined && d.rating !== '') d.rating = parseFloat(d.rating) || 0;
  if (files) {
    if (files.posterImage?.[0]) d.posterImage = '/uploads/' + files.posterImage[0].filename;
    if (files.bannerImage?.[0]) d.bannerImage = '/uploads/' + files.bannerImage[0].filename;
  }
  return d;
};

// Public
const getAllContent = async (req, res) => {
  try {
    const { type, genre, year, rating, search, sort = '-createdAt', page = 1, limit = 24 } = req.query;
    const q = { published: true };
    if (type) q.type = type;
    if (genre) q.genres = { $in: [genre] };
    if (year) q.year = year;
    if (rating) q.rating = { $gte: parseFloat(rating) };
    if (search) q.$or = [{ title: new RegExp(search, 'i') }, { shortDescription: new RegExp(search, 'i') }];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [content, total] = await Promise.all([Content.find(q).sort(sort).skip(skip).limit(parseInt(limit)).select('-videoServers -downloadLinks'), Content.countDocuments(q)]);
    res.json({ content, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch { res.status(500).json({ error: 'Server error' }); }
};
const getContentBySlug = async (req, res) => {
  try {
    const content = await Content.findOneAndUpdate({ slug: req.params.slug, published: true }, { $inc: { views: 1 } }, { new: true }).populate('category', 'name slug');
    if (!content) return res.status(404).json({ error: 'Not found' });
    const [comments, episodes, related] = await Promise.all([
      Comment.find({ content: content._id, approved: true }).populate('user', 'name avatar').sort({ createdAt: -1 }).limit(20),
      Episode.find({ content: content._id }).sort({ season: 1, episode: 1 }),
      Content.find({ genres: { $in: content.genres }, _id: { $ne: content._id }, published: true }).limit(8).select('title slug posterImage year rating type')
    ]);
    res.json({ content, comments, episodes, related });
  } catch { res.status(500).json({ error: 'Server error' }); }
};
const getFeatured = async (req, res) => { try { res.json(await Content.find({ featured: true, published: true }).limit(10).select('title slug posterImage bannerImage shortDescription year rating type duration trailerLink ageRating')); } catch { res.status(500).json({ error: 'Server error' }); } };
const getTrending = async (req, res) => { try { res.json(await Content.find({ trending: true, published: true }).sort({ views: -1 }).limit(20).select('title slug posterImage year rating type')); } catch { res.status(500).json({ error: 'Server error' }); } };
const getLatest = async (req, res) => { try { res.json(await Content.find({ latest: true, published: true }).sort({ createdAt: -1 }).limit(20).select('title slug posterImage year rating type')); } catch { res.status(500).json({ error: 'Server error' }); } };
const getRecommended = async (req, res) => { try { res.json(await Content.find({ recommended: true, published: true }).limit(20).select('title slug posterImage year rating type')); } catch { res.status(500).json({ error: 'Server error' }); } };
const getEpisodesByContent = async (req, res) => { try { res.json(await Episode.find({ content: req.params.contentId }).sort({ season: 1, episode: 1 })); } catch { res.status(500).json({ error: 'Server error' }); } };

// Admin CRUD
const adminGetAll = async (req, res) => { try { res.json(await Content.find().sort({ createdAt: -1 }).select('title slug type year rating views published featured trending posterImage')); } catch { res.status(500).json({ error: 'Server error' }); } };
const adminGetOne = async (req, res) => { try { const c = await Content.findById(req.params.id); if (!c) return res.status(404).json({ error: 'Not found' }); res.json(c); } catch { res.status(500).json({ error: 'Server error' }); } };
const adminCreate = async (req, res) => {
  try {
    const data = processBody(req.body, req.files);
    if (!data.title) return res.status(400).json({ error: 'Title required' });
    if (!data.slug) data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const c = await new Content(data).save();
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const adminUpdate = async (req, res) => {
  try {
    const data = processBody(req.body, req.files);
    const c = await Content.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const adminDelete = async (req, res) => { try { await Content.findByIdAndDelete(req.params.id); await Episode.deleteMany({ content: req.params.id }); res.json({ message: 'Deleted' }); } catch { res.status(500).json({ error: 'Server error' }); } };

// Admin Episodes
const adminGetEpisodes = async (req, res) => { try { res.json(await Episode.find({ content: req.params.id }).sort({ season: 1, episode: 1 })); } catch { res.status(500).json({ error: 'Server error' }); } };
const adminCreateEpisode = async (req, res) => {
  try {
    const d = { ...req.body };
    if (typeof d.videoServers === 'string') try { d.videoServers = JSON.parse(d.videoServers); } catch { d.videoServers = []; }
    if (req.file) d.thumbnail = '/uploads/' + req.file.filename;
    const ep = await new Episode(d).save();
    res.json(ep);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const adminUpdateEpisode = async (req, res) => {
  try {
    const d = { ...req.body };
    if (typeof d.videoServers === 'string') try { d.videoServers = JSON.parse(d.videoServers); } catch { d.videoServers = []; }
    if (req.file) d.thumbnail = '/uploads/' + req.file.filename;
    const ep = await Episode.findByIdAndUpdate(req.params.id, d, { new: true });
    res.json(ep);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const adminDeleteEpisode = async (req, res) => { try { await Episode.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch { res.status(500).json({ error: 'Server error' }); } };

const approveComment = async (req, res) => { try { const c = await Comment.findByIdAndUpdate(req.params.id, { approved: true }, { new: true }); res.json(c); } catch { res.status(500).json({ error: 'Server error' }); } };

module.exports = { getAllContent, getContentBySlug, getFeatured, getTrending, getLatest, getRecommended, getEpisodesByContent, adminGetAll, adminGetOne, adminCreate, adminUpdate, adminDelete, adminGetEpisodes, adminCreateEpisode, adminUpdateEpisode, adminDeleteEpisode, approveComment };
