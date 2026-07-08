const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const logger = require('./utils/logger');
const { initializeDatabase } = require('./config/database');
const masterPanel = require('./services/masterPanel');
const { seedDefaultAdmin } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const corsOrigins = config.allowedOrigins;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'RATE_LIMITED', message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// Health check (must be before protected routes)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    masterPanel: masterPanel.checkHealth(),
    dbConnected: global.dbConnected || false,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Serve frontend in production
if (config.isProduction) {
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendDist, 'index.html'));
      }
    });
  }
}

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Rota não encontrada',
    path: req.path,
  });
});

async function start() {
  try {
    await initializeDatabase();
    global.dbConnected = true;
    logger.info('Database initialized successfully');
  } catch (err) {
    global.dbConnected = false;
    logger.warn('Database not available, running in file-based mode', { error: err.message });
    logger.warn('User data will be stored in JSON files. PostgreSQL recommended for production.');
  }

  // Seed default admin/operator users (for file-based mode or if DB is empty)
  try {
    await seedDefaultAdmin();
    logger.info('Default users seeded successfully');
  } catch (err) {
    logger.warn('Could not seed default users (they may already exist)', { error: err.message });
  }

  try {
    await masterPanel.login();
    logger.info('Master panel connection established');
  } catch (err) {
    logger.warn('Master panel not available, running in offline mode', { error: err.message });
  }

  const server = app.listen(config.port, () => {
    logger.info(`JCopSIP backend running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Frontend URL: ${config.frontendUrl}`);
    logger.info(`Database: ${global.dbConnected ? 'Connected' : 'File-based mode'}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

start();
