const User = require('../models/User');
const Content = require('../models/Content');
const Comment = require('../models/Comment');
const jwt = require('jsonwebtoken');

const userRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (await User.findOne({ email })) return res.status(400).json({ error: 'Email already registered' });
    const user = await new User({ name, email, password }).save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_USER_SECRET || 'user_secret', { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) return res.status(400).json({ error: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ error: 'Account banned' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_USER_SECRET || 'user_secret', { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('watchlist', 'title slug posterImage year rating type').populate('watchHistory.content', 'title slug posterImage year rating type').populate('continueWatching.content', 'title slug posterImage');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const updateProfile = async (req, res) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.file) updates.avatar = '/uploads/' + req.file.filename;
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const toggleWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const cid = req.params.contentId;
    const idx = user.watchlist.indexOf(cid);
    if (idx > -1) { user.watchlist.splice(idx, 1); await user.save(); res.json({ added: false }); }
    else { user.watchlist.unshift(cid); await user.save(); res.json({ added: true }); }
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const updateProgress = async (req, res) => {
  try {
    const { contentId, progress, episodeId } = req.body;
    const user = await User.findById(req.user.id);
    // Update continueWatching
    const cwIdx = user.continueWatching.findIndex(x => x.content?.toString() === contentId);
    if (cwIdx > -1) { user.continueWatching[cwIdx].progress = progress; user.continueWatching[cwIdx].lastWatched = new Date(); }
    else { user.continueWatching.unshift({ content: contentId, progress, lastWatched: new Date() }); if (user.continueWatching.length > 20) user.continueWatching.pop(); }
    // Update watchHistory
    const whIdx = user.watchHistory.findIndex(x => x.content?.toString() === contentId);
    if (whIdx === -1) { user.watchHistory.unshift({ content: contentId, watchedAt: new Date() }); if (user.watchHistory.length > 100) user.watchHistory.pop(); }
    await user.save();
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const addComment = async (req, res) => {
  try {
    const { contentId, text, rating } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment text required' });
    const comment = await new Comment({ content: contentId, user: req.user.id, text, rating: rating ? parseInt(rating) : undefined, approved: true }).save();
    if (rating) {
      const content = await Content.findById(contentId);
      if (content) {
        const newCount = (content.ratingCount || 0) + 1;
        const newRating = ((content.rating || 0) * (content.ratingCount || 0) + parseInt(rating)) / newCount;
        await Content.findByIdAndUpdate(contentId, { rating: newRating, ratingCount: newCount });
      }
    }
    res.json(comment);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const getUserNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notifications');
    res.json(user?.notifications || []);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const markNotifsRead = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $set: { 'notifications.$[].read': true } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
};

module.exports = { userRegister, userLogin, getProfile, updateProfile, toggleWatchlist, updateProgress, addComment, getUserNotifications, markNotifsRead };
