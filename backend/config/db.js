const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const URI_FILE = path.join(DATA_DIR, 'mongo_uri.txt');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let currentUri = '';

const saveUri = (uri) => {
  try { fs.writeFileSync(URI_FILE, uri, 'utf8'); } catch (e) { console.error('Could not save URI:', e.message); }
};

const loadSavedUri = () => {
  try { return fs.existsSync(URI_FILE) ? fs.readFileSync(URI_FILE, 'utf8').trim() : null; } catch { return null; }
};

const deleteSavedUri = () => {
  try { if (fs.existsSync(URI_FILE)) fs.unlinkSync(URI_FILE); } catch {}
};

const connectDB = async (uri) => {
  const mongoUri = uri || loadSavedUri() || process.env.MONGO_URI;
  if (!mongoUri) return false;
  try {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000 });
    currentUri = mongoUri;
    saveUri(mongoUri);
    console.log('✅ MongoDB Connected & URI saved!');
    return true;
  } catch (err) { console.error('DB Error:', err.message); return false; }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    currentUri = '';
    deleteSavedUri();
    console.log('🔌 MongoDB Disconnected & URI cleared.');
    return true;
  } catch { return false; }
};

const getStatus = () => ({
  connected: mongoose.connection.readyState === 1,
  uri: currentUri ? currentUri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@') : null,
  hasSavedUri: !!loadSavedUri()
});

module.exports = { connectDB, disconnectDB, getStatus, loadSavedUri };
