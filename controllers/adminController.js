const Admin = require('../models/Admin');
const User = require('../models/User');
const Content = require('../models/Content');
const Comment = require('../models/Comment');
const { Notification } = require('../models/Other');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.comparePassword(password))) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const getAnalytics = async (req, res) => {
  try {
    const [totalContent, totalUsers, totalComments, totalViewsArr] = await Promise.all([
      Content.countDocuments(), User.countDocuments(), Comment.countDocuments(),
      Content.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }])
    ]);
    const contentByType = await Content.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name email createdAt');
    const topContent = await Content.find().sort({ views: -1 }).limit(5).select('title views type posterImage');
    res.json({ totalContent, totalUsers, totalComments, totalViews: totalViewsArr[0]?.total || 0, contentByType, recentUsers, topContent });
  } catch { res.status(500).json({ error: 'Server error' }); }
};

const createDefaultAdmin = async () => {
  try {
    if (await Admin.countDocuments() === 0) {
      await new Admin({ name: 'Admin', email: 'admin@ottverse.com', password: 'admin123' }).save();
      console.log('Default admin created: admin@ottverse.com / admin123');
    }
  } catch {}
};

const getUsers = async (req, res) => {
  try { res.json(await User.find().select('-password').sort({ createdAt: -1 })); } catch { res.status(500).json({ error: 'Server error' }); }
};
const toggleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    user.isActive = !user.isActive; await user.save(); res.json(user);
  } catch { res.status(500).json({ error: 'Server error' }); }
};
const deleteUser = async (req, res) => {
  try { await User.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch { res.status(500).json({ error: 'Server error' }); }
};
const sendNotification = async (req, res) => {
  try {
    const { title, message, type, targetUser, link } = req.body;
    await new Notification({ title, message, type, targetUser, link }).save();
    if (type === 'all') await User.updateMany({}, { $push: { notifications: { message: `${title}: ${message}` } } });
    else if (targetUser) await User.findByIdAndUpdate(targetUser, { $push: { notifications: { message: `${title}: ${message}` } } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
};
const getNotifications = async (req, res) => {
  try { res.json(await Notification.find().sort({ sentAt: -1 }).limit(50)); } catch { res.status(500).json({ error: 'Server error' }); }
};
const getComments = async (req, res) => {
  try { res.json(await require('../models/Comment').find().populate('user','name email').populate('content','title').sort({ createdAt: -1 })); } catch { res.status(500).json({ error: 'Server error' }); }
};
const deleteComment = async (req, res) => {
  try { await require('../models/Comment').findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch { res.status(500).json({ error: 'Server error' }); }
};

module.exports = { login, getAnalytics, createDefaultAdmin, getUsers, toggleUser, deleteUser, sendNotification, getNotifications, getComments, deleteComment };
