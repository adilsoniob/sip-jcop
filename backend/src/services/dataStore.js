const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'lines.json');

class DataStore {
  constructor() {
    this.lines = [];
    this.nextId = 1;
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        this.lines = data.lines || [];
        this.nextId = data.nextId || this.lines.length + 1;
        logger.info(`DataStore loaded ${this.lines.length} lines`);
      } else {
        this._seed();
      }
    } catch (err) {
      logger.warn('Failed to load data file, seeding defaults', { error: err.message });
      this._seed();
    }
  }

  _seed() {
    this.lines = [
      { id: 1, name: 'Linha Comercial 1', number: '1130000001', sipUser: 'sip1001', sipPassword: 'sip@2026a', status: 'active', created_at: '2026-01-15T10:00:00Z' },
      { id: 2, name: 'Linha Comercial 2', number: '1130000002', sipUser: 'sip1002', sipPassword: 'sip@2026b', status: 'active', created_at: '2026-01-15T10:30:00Z' },
      { id: 3, name: 'Linha Administrativa', number: '1130000003', sipUser: 'sip1003', sipPassword: 'sip@2026c', status: 'inactive', created_at: '2026-02-01T08:00:00Z' },
      { id: 4, name: 'Linha Suporte', number: '1130000004', sipUser: 'sip1004', sipPassword: 'sip@2026d', status: 'active', created_at: '2026-03-10T14:00:00Z' },
      { id: 5, name: 'Linha Financeiro', number: '1130000005', sipUser: 'sip1005', sipPassword: 'sip@2026e', status: 'active', created_at: '2026-04-20T09:00:00Z' },
    ];
    this.nextId = 6;
    this._save();
  }

  _save() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify({ lines: this.lines, nextId: this.nextId }, null, 2));
    } catch (err) {
      logger.error('Failed to save data file', { error: err.message });
    }
  }

  getAll(search = '') {
    if (!search) return [...this.lines];
    const term = search.toLowerCase();
    return this.lines.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(term)) ||
        (l.number && l.number.toLowerCase().includes(term)) ||
        (l.sipUser && l.sipUser.toLowerCase().includes(term))
    );
  }

  getById(id) {
    return this.lines.find((l) => l.id === id) || null;
  }

  create(data) {
    const line = {
      id: this.nextId++,
      name: data.name,
      number: data.number || '',
      sipUser: data.sipUser,
      sipPassword: data.sipPassword || '',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    this.lines.push(line);
    this._save();
    return line;
  }

  update(id, data) {
    const idx = this.lines.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const line = this.lines[idx];
    if (data.name !== undefined) line.name = data.name;
    if (data.number !== undefined) line.number = data.number;
    if (data.sipUser !== undefined) line.sipUser = data.sipUser;
    if (data.sipPassword !== undefined) line.sipPassword = data.sipPassword;
    line.updated_at = new Date().toISOString();
    this._save();
    return line;
  }

  delete(id) {
    const idx = this.lines.findIndex((l) => l.id === id);
    if (idx === -1) return false;
    this.lines.splice(idx, 1);
    this._save();
    return true;
  }

  getStats() {
    return {
      totalLines: this.lines.length,
      activeLines: this.lines.filter((l) => l.status === 'active').length,
      inactiveLines: this.lines.filter((l) => l.status !== 'active').length,
      lastSync: new Date().toISOString(),
    };
  }
}

module.exports = new DataStore();
