const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const auditLog = require('../services/auditLog');
const logger = require('../utils/logger');

const router = express.Router();

// JSON file-based user store (fallback when DB is not available)
const USERS_FILE = path.join(__dirname, '..', '..', 'data', 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch {}
  return { users: [], nextId: 1 };
}

function saveUsers(data) {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

async function getUsers() {
  if (global.dbConnected) {
    try {
      const result = await query(
        'SELECT id, username, email, profile, status, created_at, last_access FROM users ORDER BY id ASC'
      );
      return result.rows;
    } catch {
      // Fallback to file
    }
  }
  return loadUsers().users;
}

async function createUser(username, email, password, profile) {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);

  if (global.dbConnected) {
    try {
      const result = await query(
        'INSERT INTO users (username, email, password_hash, profile, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, profile, status, created_at',
        [username, email || null, hash, profile || 'operator', 'active']
      );
      return result.rows[0];
    } catch {
      // Fallback to file
    }
  }

  const data = loadUsers();
  const existing = data.users.find((u) => u.username === username);
  if (existing) throw new Error('DUPLICATE_USER');

  const user = {
    id: data.nextId++,
    username,
    email: email || null,
    password_hash: hash,
    profile: profile || 'operator',
    status: 'active',
    created_at: new Date().toISOString(),
    last_access: null,
  };
  data.users.push(user);
  saveUsers(data);
  return { id: user.id, username: user.username, email: user.email, profile: user.profile, status: user.status, created_at: user.created_at };
}

async function updateUser(id, updates) {
  if (global.dbConnected) {
    try {
      const sets = [];
      const values = [];
      let idx = 1;
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          sets.push(`${key} = $${idx++}`);
          values.push(value);
        }
      }
      if (sets.length === 0) return false;
      sets.push('updated_at = NOW()');
      values.push(id);
      const result = await query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`,
        values
      );
      return result.rowCount > 0;
    } catch {
      // Fallback to file
    }
  }

  const data = loadUsers();
  const user = data.users.find((u) => u.id === parseInt(id));
  if (!user) return false;

  if (updates.username !== undefined) user.username = updates.username;
  if (updates.email !== undefined) user.email = updates.email;
  if (updates.profile !== undefined) user.profile = updates.profile;
  if (updates.status !== undefined) user.status = updates.status;
  user.updated_at = new Date().toISOString();
  saveUsers(data);
  return true;
}

async function changeUserPassword(id, password) {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);

  if (global.dbConnected) {
    try {
      await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, id]);
      return;
    } catch {}
  }

  const data = loadUsers();
  const user = data.users.find((u) => u.id === parseInt(id));
  if (user) {
    user.password_hash = hash;
    user.updated_at = new Date().toISOString();
    saveUsers(data);
  }
}

async function deleteUser(id) {
  if (global.dbConnected) {
    try {
      const result = await query('DELETE FROM users WHERE id = $1', [id]);
      return result.rowCount > 0;
    } catch {}
  }

  const data = loadUsers();
  const idx = data.users.findIndex((u) => u.id === parseInt(id));
  if (idx === -1) return false;
  data.users.splice(idx, 1);
  saveUsers(data);
  return true;
}

// All admin routes require auth + admin middleware
router.use(authMiddleware, adminMiddleware);

router.get('/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ users });
  } catch (err) {
    logger.error('Error listing users', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao listar usuários' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, email, password, profile } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Usuário e senha são obrigatórios' });
    }

    const user = await createUser(username, email, password, profile);
    await auditLog.log(req.user.id, 'USER_CREATED', { username }, req.ip);
    logger.info('User created', { createdBy: req.user.username, newUser: username });

    res.status(201).json({ user });
  } catch (err) {
    if (err.message === 'DUPLICATE_USER') {
      return res.status(409).json({ error: 'DUPLICATE_USER', message: 'Este usuário já existe' });
    }
    logger.error('Error creating user', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao criar usuário' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, profile, status } = req.body;

    const updated = await updateUser(id, { username, email, profile, status });
    if (!updated) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' });
    }

    await auditLog.log(req.user.id, 'USER_UPDATED', { userId: id, updates: { username, email, profile, status } }, req.ip);
    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (err) {
    logger.error('Error updating user', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao atualizar usuário' });
  }
});

router.put('/users/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'A senha deve ter no mínimo 4 caracteres',
      });
    }

    await changeUserPassword(id, password);
    await auditLog.log(req.user.id, 'PASSWORD_CHANGED', { userId: id }, req.ip);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    logger.error('Error changing password', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao alterar senha' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        error: 'SELF_DELETE',
        message: 'Você não pode excluir seu próprio usuário',
      });
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' });
    }

    await auditLog.log(req.user.id, 'USER_DELETED', { userId: id }, req.ip);
    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (err) {
    logger.error('Error deleting user', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao excluir usuário' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = auditLog.getLogs(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (err) {
    logger.error('Error fetching logs', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao buscar logs' });
  }
});

module.exports = router;
