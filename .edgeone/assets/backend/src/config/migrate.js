const bcrypt = require('bcryptjs');
const { getPool, initializeDatabase } = require('./database');
const logger = require('../utils/logger');

async function runMigration() {
  try {
    await initializeDatabase();

    const pool = getPool();

    const adminCount = await pool.query("SELECT COUNT(*) FROM users WHERE profile = 'admin'");
    if (parseInt(adminCount.rows[0].count) === 0) {
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash('admin123', salt);

      await pool.query(
        `INSERT INTO users (username, email, password_hash, profile, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin', 'admin@jcopsip.com', hash, 'admin', 'active']
      );

      logger.info('Default admin user created');
      console.log('✓ Default admin user created: admin / admin123');
    } else {
      console.log('✓ Admin user already exists');
    }

    console.log('✓ Migration completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed', { error: err.message });
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
