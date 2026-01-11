const paymentService = require('../services/paymentService');

async function getQueue(req, res, next) {
  try {
    const queue = await paymentService.getCurrentQueue();
    res.json({ queue });
  } catch (err) { next(err); }
}

async function callNext(req, res, next) {
  try {
    const result = await paymentService.callNextPatient();
    res.json(result);
  } catch (err) { next(err); }
}

async function complete(req, res, next) {
  try {
    const { paymentId } = req.body;
    const result = await paymentService.completePatient(paymentId);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { getQueue, callNext, complete };