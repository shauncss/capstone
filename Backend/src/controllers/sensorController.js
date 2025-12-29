const sensorLogModel = require('../models/sensorLogModel');
const socketService = require('../services/socketService');

async function heartbeat(req, res, next) {
  try {
    const {
      piIdentifier = 'pi-main',
      status = 'online',
      temp,
      spo2,
      hr
    } = req.body;

    const log = await sensorLogModel.logHeartbeat({
      pi_identifier: piIdentifier,
      status,
      temp,
      spo2,
      hr
    });

    socketService.emit('pi_status', { ...log });

    return res.json({ message: 'heartbeat received', log });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  heartbeat
};
