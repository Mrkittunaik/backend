const auth = require('./auth');
const upload = require('./upload');
module.exports = {
  adminAuth: auth.adminAuth,
  userAuth: auth.userAuth,
  optionalAuth: auth.optionalUserAuth || auth.optionalAuth,
  upload
};
