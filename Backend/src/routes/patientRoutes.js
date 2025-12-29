const express = require('express');
const patientController = require('../controllers/patientController');

const router = express.Router();

router.post('/checkin', patientController.checkIn);

module.exports = router;
