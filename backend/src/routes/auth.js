const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { generateToken, authenticateUser, verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Usuário e senha são obrigatórios',
      });
    }

    const user = await authenticateUser(username, password);

    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Usuário ou senha inválidos',
      });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Erro interno ao processar login',
    });
  }
});

router.get('/check', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ authenticated: false, user: null });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.json({ authenticated: false, user: null });
    }

    // Check from JSON file
    try {
      const usersFile = path.join(__dirname, '..', '..', 'data', 'users.json');
      if (fs.existsSync(usersFile)) {
        const data = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
        const user = data.users.find((u) => u.id === decoded.id && u.status === 'active');
        if (user) {
          return res.json({
            authenticated: true,
            user: {
              id: user.id,
              username: user.username,
              email: user.email || null,
              profile: user.profile,
              status: user.status,
              last_access: user.last_access,
            },
          });
        }
      }
    } catch (err) {
      logger.warn('File-based auth check failed', { error: err.message });
    }

    // Fallback: trust the JWT payload
    res.json({
      authenticated: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        profile: decoded.profile,
      },
    });
  } catch (err) {
    logger.error('Auth check error', { error: err.message });
    res.json({ authenticated: false, user: null });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logout realizado com sucesso' });
});

module.exports = router;
