const queueService = require('../services/queueService');

async function getCurrentQueue(req, res, next) {
  try {
    const queue = await queueService.getCurrentQueue();
    return res.json({ queue });
  } catch (error) {
    next(error);
  }
}

async function getEta(req, res, next) {
  try {
    const eta = await queueService.getEtaPreview();
    return res.json(eta);
  } catch (error) {
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const { limit, page } = req.query;
    const result = await queueService.getQueueHistory({ limit, page });
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentQueue,
  getEta,
  getHistory
};
