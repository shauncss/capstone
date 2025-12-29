const queueService = require('../services/queueService');

async function checkIn(req, res, next) {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      phone,
      symptoms,
      temp,
      spo2,
      hr
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'firstName and lastName are required' });
    }

    const result = await queueService.handleCheckIn({
      firstName,
      lastName,
      dateOfBirth,
      phone,
      symptoms,
      temp,
      spo2,
      hr
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkIn
};
