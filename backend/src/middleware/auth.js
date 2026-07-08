const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');
const logger = require('../utils/logger');
const { query } = require('../config/database');

const USERS_FILE = path.join(__dirname, '..', '..', 'data', 'users.json');

function loadFileUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch {}
  return { users: [], nextId: 1 };
}

function saveFileUsers(data) {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error('Failed to save users file', { error: err.message });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, profile: user.profile },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (err) {
    return null;
  }
}

async function authenticateUser(username, password) {
  // Try database first
  if (global.dbConnected) {
    try {
      const result = await query('SELECT * FROM users WHERE username = $1 AND status = $2', [username, 'active']);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (valid) {
          await query('UPDATE users SET last_access = NOW() WHERE id = $1', [user.id]);
          return { id: user.id, username: user.username, email: user.email, profile: user.profile, status: user.status };
        }
      }
    } catch {}
  }

  // Fall back to file-based users
  const data = loadFileUsers();
  const user = data.users.find((u) => u.username === username && u.status === 'active');
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  user.last_access = new Date().toISOString();
  saveFileUsers(data);

  return { id: user.id, username: user.username, email: user.email, profile: user.profile, status: user.status };
}

async function seedDefaultAdmin() {
  const data = loadFileUsers();
  const adminExists = data.users.find((u) => u.username === 'admin');

  if (!adminExists) {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash('admin123', salt);

    data.users.push({
      id: data.nextId++,
      username: 'admin',
      email: 'admin@jcopsip.com',
      password_hash: hash,
      profile: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
      last_access: null,
    });

    // Also add a default operator
    const operatorSalt = await bcrypt.genSalt(12);
    const operatorHash = await bcrypt.hash('operator123', operatorSalt);

    data.users.push({
      id: data.nextId++,
      username: 'operator',
      email: 'operator@jcopsip.com',
      password_hash: operatorHash,
      profile: 'operator',
      status: 'active',
      created_at: new Date().toISOString(),
      last_access: null,
    });

    saveFileUsers(data);
    logger.info('Default users created: admin/admin123, operator/operator123');
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'TOKEN_REQUIRED', message: 'Token de acesso necessário' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token inválido ou expirado' });
  }

  req.user = decoded;
  next();
}

function adminMiddleware(req, res, next) {
  if (req.user.profile !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso restrito a administradores' });
  }
  next();
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateUser,
  authMiddleware,
  adminMiddleware,
  seedDefaultAdmin,
};
