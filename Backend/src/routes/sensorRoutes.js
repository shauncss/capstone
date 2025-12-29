const express = require('express');
const sensorController = require('../controllers/sensorController');

const router = express.Router();

router.post('/pi/heartbeat', sensorController.heartbeat);

module.exports = router;
