require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/jcopsip',
  },

  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-jcopsip-2026',
    timeout: parseInt(process.env.SESSION_TIMEOUT || '86400000', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-jcopsip-2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  masterPanel: {
    url: process.env.MASTER_PANEL_URL || 'https://sip.avoip.com.br',
    user: process.env.MASTER_PANEL_USER || '',
    password: process.env.MASTER_PANEL_PASSWORD || '',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  get allowedOrigins() {
    return this.frontendUrl.split(',').map(s => s.trim()).filter(Boolean);
  },
};

module.exports = config;
