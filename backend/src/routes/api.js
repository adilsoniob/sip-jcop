const express = require('express');
const masterPanel = require('../services/masterPanel');
const dataStore = require('../services/dataStore');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authMiddleware);

router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await masterPanel.getDashboardStats();
    res.json(stats);
  } catch (err) {
    logger.error('Dashboard stats error from master panel', { error: err.message });
    // Fallback to local data
    const stats = dataStore.getStats();
    res.json(stats);
  }
});

router.get('/lines', async (req, res) => {
  try {
    const { search, page } = req.query;
    const result = await masterPanel.getLines(search || '', parseInt(page) || 1);
    res.json(result);
  } catch (err) {
    logger.error('Error fetching lines from master panel', { error: err.message });
    // Fallback to local data
    const lines = dataStore.getAll(req.query.search || '');
    res.json({ lines, total: lines.length, page: 1, perPage: 50 });
  }
});

router.get('/lines/:id', async (req, res) => {
  try {
    // Fetch full details including real password from master panel edit page
    const details = await masterPanel.getLineDetails(req.params.id);
    return res.json(details);
  } catch (err) {
    logger.error('Error fetching line details', { error: err.message, lineId: req.params.id });
    // Fallback: try from cached list
    try {
      const result = await masterPanel.getLines();
      const line = result.lines.find((l) => l.id === parseInt(req.params.id));
      if (line) return res.json(line);
    } catch {}
    // Fallback: local data
    const line = dataStore.getById(parseInt(req.params.id));
    if (!line) return res.status(404).json({ error: 'NOT_FOUND', message: 'Linha não encontrada' });
    res.json(line);
  }
});

router.post('/lines/quick-create', async (req, res) => {
  try {
    const result = await masterPanel.quickCreateSipUser();
    logger.info('Quick-create user created on master panel', {
      sipUser: result.sipUser,
      createdBy: req.user.username,
    });
    res.json({
      success: true,
      message: 'Usuário SIP criado com sucesso',
      sipUser: result.sipUser,
      sipPassword: result.sipPassword,
      callerId: result.callerId,
      name: result.name,
      number: result.lineNumber,
    });
  } catch (err) {
    logger.error('Quick-create failed', { error: err.message });
    res.status(502).json({
      error: 'CREATE_FAILED',
      message: 'Erro ao criar usuário SIP no painel mestre',
    });
  }
});

router.post('/lines', async (req, res) => {
  try {
    const { name, number, sipUser, sipPassword, callerId, callerIdName } = req.body;

    if (!sipUser || !sipPassword) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Usuário SIP e senha SIP são obrigatórios',
      });
    }

    // Auto-generate number if not provided
    const lineNumber = number || '';

    const lineData = {
      name: name || sipUser,
      number: lineNumber,
      sipUser,
      sipPassword,
      callerId: callerId || lineNumber || '',
      callerIdName: callerIdName || name || '',
      lineNumber: lineNumber,
    };

    // Execute on real master panel
    try {
      const result = await masterPanel.executeAction('add', lineData);
      logger.info('Line created on master panel', { sipUser, createdBy: req.user.username });
      return res.json({
        success: true,
        message: 'Linha criada com sucesso no painel mestre',
        number: result.lineNumber || lineNumber,
      });
    } catch (masterErr) {
      logger.warn('Master panel add failed, saving locally', { error: masterErr.message });
      const line = dataStore.create({ name: sipUser, number, sipUser, sipPassword });
      return res.json({ success: true, message: 'Linha criada no modo offline', line });
    }
  } catch (err) {
    logger.error('Error creating line', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao criar linha' });
  }
});

// ======== DEBUG: Investigar por que o callerId nao persiste ========
router.get('/lines/:id/debug', async (req, res) => {
  try {
    const lineId = req.params.id;
    const MasterPanel = require('../services/masterPanel');
    
    await MasterPanel.ensureAuthenticated();
    
    // 1. Fetch the edit page HTML
    const editHtml = await MasterPanel.fetchFromPanel(`/manutLinhas/edit/${lineId}`);
    
    // Extract ALL form fields
    const extractValue = (fieldId) => {
      const regex = new RegExp(`id="${fieldId}"[^>]*value="([^"]*)"`, 'i');
      const match = editHtml.match(regex);
      return match ? match[1] : null;
    };
    
    const formFields = {
      txtUsuario: extractValue('txtUsuario'),
      txtSenha: extractValue('txtSenha'),
      txtLinhaIP: extractValue('txtLinhaIP'),
      txtCallerID: extractValue('txtCallerID'),
      txtCallerIDName: extractValue('txtCallerIDName'),
    };
    
    // Check if txtCallerID input is disabled/readonly
    const callerIdInputMatch = editHtml.match(/id="txtCallerID"[^>]*/i);
    const callerIdInputAttrs = callerIdInputMatch ? callerIdInputMatch[0] : 'NOT FOUND';
    
    // 2. Build raw form data and POST to master panel directly
    const formData = MasterPanel._buildLineFormData({
      ...formFields,
      callerId: 'DEBUG_TEST_BINA_999',
    }, true);
    
    // Direct axios call to see raw response
    const axios = require('axios');
    const https = require('https');
    const rawClient = axios.create({
      baseURL: 'https://sip.avoip.com.br',
      timeout: 30000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    
    const rawResponse = await rawClient.post(
      `/manutLinhas/edit/${lineId}`,
      formData,
      {
        headers: {
          'Cookie': MasterPanel._getCookieHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    // 3. Re-fetch edit page to see if callerId changed
    const updatedHtml = await MasterPanel.fetchFromPanel(`/manutLinhas/edit/${lineId}`);
    const updatedCallerId = extractValueFromHtml(updatedHtml, 'txtCallerID');
    
    res.json({
      lineId,
      currentFormFields: formFields,
      callerIdInputAttrs,
      formDataSent: formData.substring(0, 300),
      rawResponseStatus: rawResponse.status,
      rawResponseData: String(rawResponse.data).substring(0, 500),
      updatedCallerId,
    });
    
    function extractValueFromHtml(html, fieldId) {
      const re = new RegExp(`id="${fieldId}"[^>]*value="([^"]*)"`, 'i');
      const m = html.match(re);
      return m ? m[1] : null;
    }
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.put('/lines/:id', async (req, res) => {
  try {
    const { name, number, sipUser, sipPassword, callerId, callerIdName } = req.body;
    const id = parseInt(req.params.id);

    const lineData = { id };
    if (name) lineData.name = name;
    if (number !== undefined) lineData.number = number;
    if (sipUser) lineData.sipUser = sipUser;
    if (sipPassword) lineData.sipPassword = sipPassword;
    if (callerId !== undefined) lineData.callerId = callerId;
    if (callerIdName !== undefined) lineData.callerIdName = callerIdName;
    if (number) lineData.lineNumber = number;

    try {
      await masterPanel.executeAction('edit', lineData);
      logger.info('Line updated on master panel', { lineId: id, updatedBy: req.user.username });
      return res.json({ success: true, message: 'Linha atualizada no painel mestre' });
    } catch (masterErr) {
      logger.warn('Master panel update failed, updating locally', { error: masterErr.message });
      const updated = dataStore.update(id, { name, number, sipUser, sipPassword });
      if (!updated) return res.status(404).json({ error: 'NOT_FOUND', message: 'Linha não encontrada' });
      return res.json({ success: true, message: 'Linha atualizada no modo offline' });
    }
  } catch (err) {
    logger.error('Error updating line', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao atualizar linha' });
  }
});

router.delete('/lines/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    try {
      await masterPanel.executeAction('delete', { id });
      logger.info('Line deleted from master panel', { lineId: id, deletedBy: req.user.username });
      return res.json({ success: true, message: 'Linha excluída do painel mestre' });
    } catch (masterErr) {
      logger.warn('Master panel delete failed, deleting locally', { error: masterErr.message });
      const deleted = dataStore.delete(id);
      if (!deleted) return res.status(404).json({ error: 'NOT_FOUND', message: 'Linha não encontrada' });
      return res.json({ success: true, message: 'Linha excluída no modo offline' });
    }
  } catch (err) {
    logger.error('Error deleting line', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao excluir linha' });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const result = await masterPanel.sync();
    logger.info('Manual sync completed', { requestedBy: req.user.username, count: result.linesCount });
    res.json({ success: true, message: 'Sincronização concluída com o painel mestre', ...result });
  } catch (err) {
    logger.error('Sync error', { error: err.message });
    res.status(502).json({ error: 'SYNC_ERROR', message: 'Erro ao sincronizar com o painel mestre' });
  }
});

router.get('/sip-lines', async (req, res) => {
  try {
    const result = await masterPanel.getLines();
    res.json({ lines: result.lines });
  } catch (err) {
    logger.error('Error fetching SIP lines', { error: err.message });
    const lines = dataStore.getAll();
    res.json({ lines });
  }
});

router.get('/dashboard/timeline', async (req, res) => {
  res.json({
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'],
    data: [12, 15, 18, 22, 25, 28, 32],
  });
});

module.exports = router;
