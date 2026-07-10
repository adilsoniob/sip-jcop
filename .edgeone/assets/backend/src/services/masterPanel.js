const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../utils/logger');

const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'master-panel-cache.json');
const SESSION_KEEPALIVE_INTERVAL = 4 * 60 * 1000; // 4 minutes (within the 5-min session window)

class MasterPanelService {
  constructor() {
    this.sessionCookie = null;
    this.ctrlSession = null;
    this.lastLogin = null;
    this.isAuthenticated = false;
    this.loginAttempts = 0;
    this.maxRetries = 3;
    this._cachedLines = [];
    this._lastFetch = null;
    this._keepAliveTimer = null;
    this._loginPromise = null;

    // Circuit breaker
    this._consecutiveFailures = 0;
    this._circuitOpen = false;
    this._circuitOpenSince = null;
    this._maxConsecutiveFailures = 5;
    this._circuitTimeout = 5 * 60 * 1000; // 5 minutes

    // Load persisted cache from disk
    this._loadCache();

    this.client = axios.create({
      baseURL: config.masterPanel.url,
      timeout: 30000,
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
      }),
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 302 || error.response?.status === 401) {
          logger.warn('Master panel session expired (302/401), re-logging in');
          await this.login(true);
          if (error.config) {
            error.config.headers['Cookie'] = this._getCookieHeader();
            return this.client(error.config);
          }
        }
        if (error.response?.data?.logged === false) {
          logger.warn('Master panel login invalid, re-logging in');
          await this.login(true);
          if (error.config) {
            error.config.headers['Cookie'] = this._getCookieHeader();
            return this.client(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ========== PERSISTENT CACHE ==========

  _loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data.cachedLines && Array.isArray(data.cachedLines)) {
          this._cachedLines = data.cachedLines;
          this._lastFetch = data.lastFetch || null;
          logger.info(`Loaded ${this._cachedLines.length} cached lines from disk (persistent cache)`);
        }
      }
    } catch (err) {
      logger.warn('Failed to load master panel cache from disk', { error: err.message });
    }
  }

  _saveCache() {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify({
        cachedLines: this._cachedLines,
        lastFetch: this._lastFetch,
        savedAt: new Date().toISOString(),
      }, null, 2));
    } catch (err) {
      logger.warn('Failed to save master panel cache to disk', { error: err.message });
    }
  }

  // ========== SESSION KEEP-ALIVE ==========

  _startKeepAlive() {
    this._stopKeepAlive();
    this._keepAliveTimer = setInterval(async () => {
      try {
        logger.debug('Running session keep-alive ping');
        // force=true to actually refresh the session before it expires.
        // The catch block resets loginAttempts, so failures won't accumulate.
        await this.login(true);
      } catch (err) {
        // Keep-alive failures should NOT count toward the main retry limit.
        this.loginAttempts = 0;
        logger.warn('Session keep-alive failed, will retry next cycle', { error: err.message });
      }
    }, SESSION_KEEPALIVE_INTERVAL);
    // Don't let the timer keep the process alive
    if (this._keepAliveTimer && this._keepAliveTimer.unref) {
      this._keepAliveTimer.unref();
    }
  }

  _stopKeepAlive() {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
    }
  }

  // ========== AUTHENTICATION ==========

  _getCookieHeader() {
    if (!this.sessionCookie) return '';
    return `nextbilling_session=${this.sessionCookie}${this.ctrlSession ? `; ctrl_nextbilling_sess=${this.ctrlSession}` : ''}`;
  }

  async login(force = false) {
    if (!force && this.isAuthenticated && this.lastLogin) {
      const elapsed = Date.now() - this.lastLogin;
      if (elapsed < 300000) return true; // 5 min cache
    }

    if (this.loginAttempts >= this.maxRetries) {
      logger.error('Max login retries reached for master panel');
      throw new Error('MAX_LOGIN_RETRIES');
    }

    // Prevent concurrent login attempts using a shared promise
    if (this._loginPromise) {
      logger.debug('Login already in progress, waiting for result...');
      return this._loginPromise;
    }

    this.loginAttempts++;

    this._loginPromise = this._doLogin().finally(() => {
      this._loginPromise = null;
    });

    return this._loginPromise;
  }

  async _doLogin() {
    try {
      logger.info('Attempting master panel login', { attempt: this.loginAttempts });

      const response = await this.client.post('/security/validate',
        `action=login&username=${encodeURIComponent(config.masterPanel.user)}&password=${encodeURIComponent(config.masterPanel.password)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0,
          timeout: 15000,
        }
      );

      if (response.data?.logged === true) {
        const cookies = response.headers['set-cookie'] || [];
        for (const cookie of cookies) {
          if (cookie.includes('nextbilling_session=')) {
            this.sessionCookie = cookie.split('nextbilling_session=')[1].split(';')[0];
          }
          if (cookie.includes('ctrl_nextbilling_sess=')) {
            const match = cookie.match(/ctrl_nextbilling_sess=([^;]+)/);
            if (match) this.ctrlSession = match[1];
          }
        }

        // Follow the redirect to fully establish session
        try {
          await this.client.post('/security/redirect', 'action=LOGIN', {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': this._getCookieHeader(),
            },
            maxRedirects: 2,
            timeout: 10000,
          });
        } catch (e) {
          // Redirect may cause 302/error — session is still set
        }

        this.isAuthenticated = true;
        this.lastLogin = Date.now();
        this.loginAttempts = 0;
        logger.info('Master panel login successful');

        // Start session keep-alive
        this._startKeepAlive();

        // Auto-fetch lines in background after successful login
        this._autoSyncAfterLogin();

        return true;
      }

      throw new Error(`Login failed: ${response.data?.msg || 'Unknown error'}`);
    } catch (err) {
      if (err.message === 'MAX_LOGIN_RETRIES') throw err;
      logger.error('Master panel login error', { error: err.message, attempt: this.loginAttempts });
      this.isAuthenticated = false;
      throw err;
    }
  }

  /**
   * Auto-sync in background after a successful login, so the panel
   * always has fresh data shortly after connecting.
   */
  async _autoSyncAfterLogin() {
    try {
      logger.info('Auto-sync: fetching lines after login...');
      const result = await this.getLines();
      logger.info(`Auto-sync completed: ${result.lines.length} lines fetched`);
    } catch (err) {
      logger.warn('Auto-sync after login failed (will retry on next request)', { error: err.message });
    }
  }

  async ensureAuthenticated() {
    if (!this.isAuthenticated) {
      await this.login();
    }
    return true;
  }

  // ========== CIRCUIT BREAKER ==========

  _isCircuitOpen() {
    if (!this._circuitOpen) return false;
    const elapsed = Date.now() - this._circuitOpenSince;
    if (elapsed >= this._circuitTimeout) {
      // Half-open: allow one probe request
      this._circuitOpen = false;
      this._circuitOpenSince = null;
      logger.info('Circuit half-open — allowing probe request to master panel');
      return false;
    }
    return true;
  }

  _recordFailure() {
    this._consecutiveFailures++;
    if (this._consecutiveFailures >= this._maxConsecutiveFailures && !this._circuitOpen) {
      this._circuitOpen = true;
      this._circuitOpenSince = Date.now();
      logger.warn(`Circuit OPEN after ${this._consecutiveFailures} consecutive failures — serving cached data for ${this._circuitTimeout / 1000}s`);
    }
  }

  _recordSuccess() {
    if (this._consecutiveFailures > 0 || this._circuitOpen) {
      logger.info(`Master panel recovered after ${this._consecutiveFailures} failures — circuit CLOSED`);
    }
    this._consecutiveFailures = 0;
    this._circuitOpen = false;
    this._circuitOpenSince = null;
  }

  // ========== DATA FETCHING WITH RETRY ==========

  async fetchFromPanel(url, retries = 2) {
    await this.ensureAuthenticated();

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const response = await this.client.get(url, {
          headers: { 'Cookie': this._getCookieHeader() },
          timeout: 20000,
        });
        // Success — record it
        this._recordSuccess();
        return response.data;
      } catch (err) {
        const isLastAttempt = attempt > retries;
        logger.warn(`fetchFromPanel attempt ${attempt}/${retries + 1} failed`, {
          url,
          error: err.message,
          code: err.code,
        });

        if (isLastAttempt) {
          // After exhausting all retries, invalidate the session so the next
          // request triggers a fresh login instead of reusing stale cookies.
          // This is the key fix: without it, isAuthenticated stays true even
          // after the master panel rejects the session, and no recovery happens.
          this.isAuthenticated = false;
          this._recordFailure();
          throw err;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Get real line data from /manutLinhas/data endpoint with automatic retry
   */
  async getLines(search = '', page = 1) {
    // Circuit breaker: if the panel has been failing, serve cache immediately
    if (this._isCircuitOpen()) {
      if (this._cachedLines.length > 0) {
        const cacheAge = this._lastFetch ? Math.round((Date.now() - this._lastFetch) / 1000) : 'unknown';
        logger.warn(`Circuit open — returning ${this._cachedLines.length} cached lines immediately (age: ${cacheAge}s)`);
        return { lines: this._cachedLines, total: this._cachedLines.length, page, perPage: 50, cached: true, cacheAge, circuitOpen: true };
      }
      // If no cache even with circuit open, force half-open probe
      this._circuitOpen = false;
      this._circuitOpenSince = null;
    }

    await this.ensureAuthenticated();

    try {
      const params = new URLSearchParams({
        SORT_DIRECTION: 'DESC',
        SORT_CHANGE: '',
        SORT_TAG: 'nome_completo',
        PAGE: page,
        txtFiltro: search,
      });

      const html = await this.fetchFromPanel(`/manutLinhas/data?${params.toString()}`);
      const lines = this._parseRealLineTable(html);

      // Only update cache if we got real data (avoid overwriting with empty on HTML change)
      if (lines.length > 0 || this._cachedLines.length === 0) {
        this._cachedLines = lines;
        this._lastFetch = Date.now();
        // Persist to disk so cache survives restarts
        this._saveCache();
      } else {
        logger.warn(`Parsed 0 lines from master panel — keeping previous cache (${this._cachedLines.length} lines)`);
      }

      if (lines.length > 0) {
        logger.info(`Successfully fetched and parsed ${lines.length} lines from master panel`);
      }

      return {
        lines,
        total: lines.length,
        page,
        perPage: 50,
      };
    } catch (err) {
      logger.error('Error fetching real lines from master panel', {
        error: err.message,
        code: err.code,
        cachedLinesAvailable: this._cachedLines.length,
      });

      // Fall back to cached data (from disk, survives restarts)
      if (this._cachedLines.length > 0) {
        const cacheAge = this._lastFetch ? Math.round((Date.now() - this._lastFetch) / 1000) : 'unknown';
        logger.info(`Returning ${this._cachedLines.length} cached lines (cache age: ${cacheAge}s)`);
        return {
          lines: this._cachedLines,
          total: this._cachedLines.length,
          page,
          perPage: 50,
          cached: true,
          cacheAge,
        };
      }

      // No cache available — throw so caller can fallback to dataStore
      throw new Error('FAILED_TO_FETCH_LINES');
    }
  }

  /**
   * Parse the real line data HTML table from /manutLinhas/data
   */
  _parseRealLineTable(html) {
    const lines = [];

    if (typeof html !== 'string') {
      logger.warn('Invalid HTML type received from /manutLinhas/data');
      return lines;
    }

    // Find the table body rows
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) {
      logger.warn('Could not find tbody in /manutLinhas/data response');
      // Debug: log first 500 chars of response to understand the structure
      logger.debug('Response preview', { preview: html.substring(0, 500) });
      return lines;
    }

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null) {
      const rowHtml = rowMatch[1];

      // Extract all td cells
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cellContents = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cellContents.push(cellMatch[1]);
      }

      if (cellContents.length < 3) continue;

      // Helper to strip remaining HTML tags from cell content
      const stripHtml = (str) => (str || '').replace(/<[^>]*>/g, '').trim();

      // Column mapping based on the real table structure:
      // 0: # (ID)
      // 1: Login / Usuário (SIP user)
      // 2: Linha (line number)
      // 3: Saldo (balance - N/A)
      // 4: Gravação (recording - ATIVO/INATIVO)
      // 5: ST (status)
      // 6: ACT (actions - links)

      const lineId = stripHtml(cellContents[0]);
      const sipUser = stripHtml(cellContents[1]);
      const lineNumber = stripHtml(cellContents[2]);
      const recording = stripHtml(cellContents[4] || '');

      // Determine status from the recording column
      const status = recording.toLowerCase() === 'ativo' ? 'active' : 'inactive';

      // Look for edit link in actions column to get the real ID
      let realId = lineId.replace(/\./g, '');
      const actionsHtml = cellContents[6] || '';
      const editMatch = actionsHtml.match(/\/manutLinhas\/edit\/(\d+)/i);
      if (editMatch) {
        realId = editMatch[1];
      }

      if (realId && sipUser) {
        lines.push({
          id: parseInt(realId) || lines.length + 1,
          name: sipUser,
          number: lineNumber,
          sipUser: sipUser,
          sipPassword: '****',
          status: status,
          recording: recording,
          masterId: lineId,
        });
      }
    }

    logger.info(`Parsed ${lines.length} real lines from master panel`);
    return lines;
  }

  /**
   * Get real dashboard stats from /inicial/view
   */
  async getDashboardStats() {
    await this.ensureAuthenticated();

    try {
      // Get line data for stats
      const linesResult = await this.getLines();
      const lines = linesResult.lines;

      // Get dashboard page for financial stats
      const dashboardHtml = await this.fetchFromPanel('/inicial/view');

      // Extract balance from dashboard
      const balanceMatch = dashboardHtml.match(/Meu Saldo atual[^$]*\$?\s*([\d.,]+)/i);
      const balance = balanceMatch ? balanceMatch[1] : '0';

      // Extract overdue payments
      const overdueMatch = dashboardHtml.match(/Pagamentos Vencidos[^$]*\$?\s*([\d.,]+)/i);
      const overdue = overdueMatch ? overdueMatch[1] : '0';

      const activeLines = lines.filter(l => l.status === 'active').length;
      const inactiveLines = lines.filter(l => l.status === 'inactive').length;

      return {
        totalLines: lines.length,
        activeLines,
        inactiveLines,
        sipLines: lines.length,
        balance: balance,
        overdue: overdue,
        lastSync: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('Error fetching real dashboard stats', { error: err.message });
      if (this._cachedLines.length > 0) {
        const lines = this._cachedLines;
        return {
          totalLines: lines.length,
          activeLines: lines.filter(l => l.status === 'active').length,
          inactiveLines: lines.filter(l => l.status === 'inactive').length,
          sipLines: lines.length,
          lastSync: new Date().toISOString(),
        };
      }
      throw new Error('FAILED_TO_FETCH_STATS');
    }
  }

  /**
   * Auto-generate a line number (7 digits)
   */
  _generateLineNumber() {
    const ts = Date.now().toString();
    const base = parseInt(ts.slice(-5)) || Math.floor(Math.random() * 90000) + 10000;
    const rand = Math.floor(Math.random() * 900) + 100;
    return `${base}${rand}`;
  }

  /**
   * Generate a unique suffix for JCOPSIP_ prefix users.
   */
  _generateJcopsipSuffix() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 90) + 10);
    return `${hh}${mm}${ss}${rand}`;
  }

  /**
   * Quick-create a SIP user with JCOPSIP_ prefix pattern
   */
  async quickCreateSipUser() {
    const suffix = this._generateJcopsipSuffix();
    const username = `JCOPSIP_${suffix}`;
    const password = `JCOPSIP_${suffix}`;
    const callerId = '114000111';

    const lineData = {
      name: username,
      number: this._generateLineNumber(),
      sipUser: username,
      sipPassword: password,
      callerId: callerId,
      callerIdName: username,
      lineNumber: this._generateLineNumber(),
    };

    const result = await this.executeAction('add', lineData);

    return {
      ...result,
      sipUser: username,
      sipPassword: password,
      callerId,
      name: username,
    };
  }

  _buildLineFormData(data, isEdit = false) {
    const params = new URLSearchParams();

    // Auth & Protocol
    params.set('txtProto', data.protocol || 'udp');
    params.set('txtAuth', data.authType || '0');
    params.set('txtDTMF', data.dtmfMode || 'rfc2833');
    params.set('txtNAT', data.nat || 'auto_force_rport');

    // SIP Credentials
    params.set('txtUsuario', data.sipUser || '');
    params.set('txtSenha', data.sipPassword || '');

    // IP & TechPrefix (for auth type 1)
    params.set('txtHost', data.host || '');
    params.set('txtPorta', data.port || '');
    params.set('txtTechPrefix', data.techPrefix || '');

    // General params
    params.set('txtTipoTar', data.billingType || '1');
    params.set('txtTipo', data.functionality || '0');
    params.set('txtTipoData', data.typeData || '');
    params.set('txtPerfilHorario', data.timeProfile || '0');
    params.set('txtAudio', data.audio || '0');

    // Audio/Media
    params.set('txtVolumeRX', data.volumeRX ?? '-21');
    params.set('txtVolumeTX', data.volumeTX ?? '-21');
    params.set('txtRTPSymmetric', data.rtpSymmetric || '0');
    params.set('txtRingFalso', data.falseRing || '0');
    params.set('txtCodecs', data.codecs || 'g729,ulaw,alaw');

    // Features & Recording
    params.set('txtAllowSPY', data.allowSpy || '0');
    params.set('txtMOHTransfer', data.mohTransfer || '0');
    params.set('txtAllowTransfer', data.allowTransfer || '0');
    params.set('txtReproduzirErros', data.playErrors || '0');
    params.set('txtAllowRecordF', data.recordFixed || '0');
    params.set('txtAllowRecordM', data.recordMobile || '0');

    // Voicemail
    params.set('txtAllowVoiceMail', data.voiceMail || '0');
    params.set('txtAllowVoiceMailPass', data.voiceMailPass || '');
    params.set('txtAllowCadeado', data.lock || '0');
    params.set('txtAllowCadeadoPass', data.lockPass || '');
    params.set('txtSenhaPortal', data.portalPass || '');

    // Follow-me
    params.set('txtSigameALL_ST', data.followMeAll || '0');
    params.set('txtSigameALL', data.followMeAllDest || '');
    params.set('txtSigameOFFLINE_ST', data.followMeOffline || '0');
    params.set('txtSigameOFFLINE', data.followMeOfflineDest || '');
    params.set('txtSigameBUSY_ST', data.followMeBusy || '0');
    params.set('txtSigameBUSY', data.followMeBusyDest || '');
    params.set('txtSigameNOANSWER_ST', data.followMeNoAnswer || '0');
    params.set('txtSigameNOANSWER', data.followMeNoAnswerDest || '');

    // BINA / Caller ID
    params.set('txtCallerIDName', data.callerIdName || '');
    params.set('txtCallerID', data.callerId || data.number || '');

    // Time & Limits
    params.set('txtSimultaneas', data.simultaneous ?? '0');
    params.set('txtRingTime', data.ringTime ?? '45');
    params.set('txtRingTimeIP', data.ringTimeIP ?? '30');
    params.set('txtCallTime', data.callTime ?? '7200');
    const lineNumber = data.lineNumber || data.number || this._generateLineNumber();
    params.set('txtLinhaIP', lineNumber);
    params.set('txtVOIP', data.ipxip ?? '1');

    // Routing permissions
    params.set('txtFixoLocal', data.fixoLocal ?? '1');
    params.set('txtFixoLDN', data.fixoLDN ?? '1');
    params.set('txtFixoDDI', data.fixoDDI ?? '0');
    params.set('txtMovelLocal', data.movelLocal ?? '1');
    params.set('txtMovelLDN', data.movelLDN ?? '1');
    params.set('txtMovelDDI', data.movelDDI ?? '0');

    // Notes
    params.set('txtMsg', data.notes || '');

    return params.toString();
  }

  /**
   * Fetch full line details including real password from the edit page
   */
  async getLineDetails(lineId) {
    await this.ensureAuthenticated();

    try {
      const html = await this.fetchFromPanel(`/manutLinhas/edit/${lineId}`);

      // Extract values from the edit form
      const extractValue = (fieldId) => {
        const regex = new RegExp(`id="${fieldId}"[^>]*value="([^"]*)"`, 'i');
        const match = html.match(regex);
        return match ? match[1] : '';
      };

      const sipUser = extractValue('txtUsuario');
      const sipPassword = extractValue('txtSenha');
      const lineNumber = extractValue('txtLinhaIP');
      const callerId = extractValue('txtCallerID');
      const callerIdName = extractValue('txtCallerIDName');

      return {
        id: parseInt(lineId),
        name: sipUser,
        number: lineNumber,
        sipUser,
        sipPassword,
        callerId: callerId || lineNumber,
        callerIdName,
        masterId: lineId,
      };
    } catch (err) {
      logger.error('Error fetching line details from edit page', { error: err.message, lineId });
      throw new Error('FAILED_TO_FETCH_LINE_DETAILS');
    }
  }

  /**
   * Execute action on master panel (add/edit/delete line) with full form data
   */
  async executeAction(action, data = {}) {
    await this.ensureAuthenticated();

    try {
      let url, method = 'GET', formData = null;

      switch (action) {
        case 'add':
          url = '/manutLinhas/add/1';
          method = 'POST';
          formData = this._buildLineFormData(data, false);
          break;

        case 'edit':
          let currentData = {};
          try {
            currentData = await this.getLineDetails(data.id);
          } catch (err) {
            logger.warn('Could not fetch current line details, proceeding with partial data', { lineId: data.id });
          }
          const mergedData = { ...currentData, ...data };
          url = `/manutLinhas/update/${data.id}?_rt=${Math.random()}`;
          method = 'POST';
          formData = this._buildLineFormData(mergedData, true);
          break;

        case 'delete':
          url = `/manutLinhas/delete/${data.id}?_rt=${Math.random()}`;
          method = 'GET';
          break;

        default:
          throw new Error('UNKNOWN_ACTION');
      }

      const response = await this.client({
        method,
        url,
        headers: {
          'Cookie': this._getCookieHeader(),
          'Content-Type': method === 'POST' ? 'application/x-www-form-urlencoded' : 'text/html',
        },
        data: formData,
      });

      let result;
      try {
        result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch {
        result = { success: true };
      }

      let generatedLineNumber = null;
      if (formData) {
        const lineNumMatch = formData.match(/txtLinhaIP=([^&]+)/);
        if (lineNumMatch) {
          generatedLineNumber = decodeURIComponent(lineNumMatch[1]);
        }
      }

      // Invalidate cache so next fetch gets fresh data
      this._cachedLines = [];

      logger.info(`Master panel action '${action}' completed`, { lineId: data.id });

      return {
        success: result.success !== false,
        message: result.msg || 'Operação realizada no painel mestre',
        response: response.data,
        lineNumber: generatedLineNumber,
      };
    } catch (err) {
      logger.error(`Error executing action ${action} on master panel`, { error: err.message });
      throw new Error(`MASTER_PANEL_ACTION_FAILED: ${action}`);
    }
  }

  /**
   * Force re-sync by clearing cache and fetching fresh data
   */
  async sync() {
    logger.info('Manual sync requested — clearing cache and fetching fresh lines');
    this._cachedLines = [];
    const linesResult = await this.getLines();
    logger.info(`Sync completed: ${linesResult.lines.length} lines`);
    return {
      linesCount: linesResult.lines.length,
      lastSync: new Date().toISOString(),
    };
  }

  checkHealth() {
    return {
      authenticated: this.isAuthenticated,
      lastLogin: this.lastLogin,
      loginAttempts: this.loginAttempts,
      cachedLines: this._cachedLines.length,
      cachePersisted: fs.existsSync(CACHE_FILE),
      keepAliveActive: !!this._keepAliveTimer,
      circuitOpen: this._circuitOpen,
      consecutiveFailures: this._consecutiveFailures,
    };
  }

  /**
   * Clean up resources (call on shutdown)
   */
  async destroy() {
    this._stopKeepAlive();
    try {
      await this.client.get('/security/logout').catch(() => {});
    } catch {
      // Ignore
    }
    this.sessionCookie = null;
    this.ctrlSession = null;
    this.isAuthenticated = false;
    logger.info('Master panel service destroyed');
  }
}

module.exports = new MasterPanelService();
