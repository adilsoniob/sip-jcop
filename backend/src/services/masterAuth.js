const axios = require('axios');
const qs = require('querystring');
const logger = require('../utils/logger');
const config = require('../config/env');

class MasterAuth {
  constructor() {
    this.session = null;
    this.lastAuth = null;
    this.authPromise = null;
  }

  async authenticate() {
    if (this.authPromise) return this.authPromise;

    this.authPromise = this._doLogin().finally(() => {
      this.authPromise = null;
    });

    return this.authPromise;
  }

  async _doLogin() {
    const cookieJar = { cookies: [] };
    const client = axios.create({
      baseURL: config.master.url,
      timeout: 30000,
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: (status) => status < 400 || status === 302,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    client.interceptors.response.use((response) => {
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        setCookie.forEach((c) => {
          const [cookie] = c.split(';');
          const [key, ...val] = cookie.split('=');
          const existing = cookieJar.cookies.findIndex((x) => x.key === key);
          if (existing >= 0) cookieJar.cookies[existing] = { key, value: val.join('=') };
          else cookieJar.cookies.push({ key, value: val.join('=') });
        });
      }
      return response;
    }, (error) => {
      if (error.response) {
        const setCookie = error.response.headers['set-cookie'];
        if (setCookie) {
          setCookie.forEach((c) => {
            const [cookie] = c.split(';');
            const [key, ...val] = cookie.split('=');
            const existing = cookieJar.cookies.findIndex((x) => x.key === key);
            if (existing >= 0) cookieJar.cookies[existing] = { key, value: val.join('=') };
            else cookieJar.cookies.push({ key, value: val.join('=') });
          });
        }
      }
      return Promise.reject(error);
    });

    client.interceptors.request.use((configReq) => {
      const cookieStr = cookieJar.cookies.map((c) => `${c.key}=${c.value}`).join('; ');
      if (cookieStr) configReq.headers.Cookie = cookieStr;
      return configReq;
    });

    logger.info('Iniciando autenticação no painel mestre...');

    const validateResp = await client.post('/security/validate',
      qs.stringify({
        action: 'login',
        username: config.master.username,
        password: config.master.password,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (!validateResp.data || !validateResp.data.logged || validateResp.data.error) {
      logger.error('Falha na autenticação no painel mestre', {
        response: validateResp.data,
      });
      throw new Error('Falha na autenticação: ' + (validateResp.data?.msg || 'Credenciais inválidas'));
    }

    logger.info('Autenticação validada, realizando redirect...');

    const redirectResp = await client.post('/security/redirect', 'action=LOGIN', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 5,
    });

    logger.info('Autenticação concluída com sucesso');

    this.session = {
      client,
      cookieJar,
      authenticatedAt: Date.now(),
    };
    this.lastAuth = Date.now();

    return this.session;
  }

  getClient() {
    if (!this.session) return null;
    return this.session.client;
  }

  getCookieString() {
    if (!this.session || !this.session.cookieJar) return '';
    return this.session.cookieJar.cookies.map((c) => `${c.key}=${c.value}`).join('; ');
  }

  isAuthenticated() {
    if (!this.session) return false;
    const elapsed = Date.now() - this.lastAuth;
    return elapsed < config.session.maxAge;
  }

  async ensureAuth() {
    if (!this.isAuthenticated()) {
      logger.info('Sessão expirada, renovando autenticação...');
      return this.authenticate();
    }
    return this.session;
  }

  async logout() {
    try {
      if (this.session) {
        await this.session.client.get('/security/logout').catch(() => {});
        logger.info('Logout do painel mestre realizado');
      }
    } catch {
      logger.warn('Erro ao fazer logout do painel mestre (ignorado)');
    }
    this.session = null;
    this.lastAuth = null;
    this.authPromise = null;
  }
}

module.exports = new MasterAuth();
