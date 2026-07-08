const logger = require('../utils/logger');

class AuditLogService {
  constructor() {
    this.logs = [];
    this.enabled = true;
  }

  async log(userId, action, details = {}, ipAddress = null) {
    const entry = {
      id: this.logs.length + 1,
      user_id: userId,
      action,
      details: typeof details === 'object' ? details : { message: details },
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    };

    this.logs.push(entry);

    // Keep only last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500);
    }

    // Try to write to database if available
    try {
      const { query } = require('../config/database');
      const pool = require('../config/database').getPool();
      if (pool) {
        await query(
          `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
          [userId, action, JSON.stringify(details), ipAddress]
        );
      }
    } catch (err) {
      // DB not available, just keep in memory
      logger.debug('Audit log DB write failed (non-critical)', { error: err.message });
    }

    logger.info(`Audit: [${action}] by user ${userId}`, { action, userId, details });

    return entry;
  }

  getLogs(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const paginated = this.logs.slice(offset, offset + limit);
    return {
      logs: paginated.reverse(),
      total: this.logs.length,
      page,
      limit,
    };
  }

  getRecent(count = 10) {
    return this.logs.slice(-count).reverse();
  }
}

module.exports = new AuditLogService();
