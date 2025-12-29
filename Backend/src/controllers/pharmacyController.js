const pharmacyService = require('../services/pharmacyService');

async function getQueue(req, res, next) {
  try {
    const queue = await pharmacyService.getCurrentQueue();
    return res.json({ queue });
  } catch (error) {
    next(error);
  }
}

async function callNext(req, res, next) {
  try {
    const entry = await pharmacyService.callNextPatient();
    return res.json({ entry });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
}

async function complete(req, res, next) {
  try {
    const { pharmacyId } = req.body;
    if (!pharmacyId) {
      return res.status(400).json({ message: 'pharmacyId is required' });
    }
    const entry = await pharmacyService.completePatient(pharmacyId);
    return res.json({ entry });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = {
  getQueue,
  callNext,
  complete
};
