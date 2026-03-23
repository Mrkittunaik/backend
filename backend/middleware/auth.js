const jwt = require('jsonwebtoken');
const adminAuth = (req, res, next) => { const t = req.header('Authorization')?.replace('Bearer ',''); if (!t) return res.status(401).json({error:'No token'}); try { req.admin = jwt.verify(t, process.env.JWT_SECRET || 'admin_secret'); next(); } catch { res.status(401).json({error:'Invalid token'}); } };
const userAuth = (req, res, next) => { const t = req.header('Authorization')?.replace('Bearer ',''); if (!t) return res.status(401).json({error:'No token'}); try { req.user = jwt.verify(t, process.env.JWT_USER_SECRET || 'user_secret'); next(); } catch { res.status(401).json({error:'Invalid token'}); } };
const optionalUserAuth = (req, res, next) => { const t = req.header('Authorization')?.replace('Bearer ',''); if (t) try { req.user = jwt.verify(t, process.env.JWT_USER_SECRET || 'user_secret'); } catch {} next(); };
module.exports = { adminAuth, userAuth, optionalUserAuth };
