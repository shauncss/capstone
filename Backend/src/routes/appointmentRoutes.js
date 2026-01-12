const express = require('express');
const appointmentController = require('../controllers/appointmentController');

const router = express.Router();

router.get('/appointments', appointmentController.getDailyAppointments);

router.get('/appointments/find', appointmentController.findMyAppointment);

router.post('/appointments/book', appointmentController.bookAppointment);

router.post('/appointments/:id/checkin', appointmentController.checkInAppointment);

module.exports = router;