const appointmentModel = require('../models/appointmentModel');
const queueService = require('../services/queueService');

async function bookAppointment(req, res, next) {
  try {
    const { firstName, lastName, phone, appointmentTime, dateOfBirth, symptoms } = req.body;
    
    if (!firstName || !lastName || !appointmentTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const appointment = await appointmentModel.createAppointment({
      first_name: firstName,
      last_name: lastName,
      phone,
      appointment_time: appointmentTime,
      date_of_birth: dateOfBirth || null,
      symptoms: symptoms,
      status: 'booked'
    });

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
}

async function findMyAppointment(req, res, next) {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ message: 'Phone number required' });

    const appointment = await appointmentModel.getAppointmentByPhone(phone);
    if (!appointment) {
      return res.status(404).json({ message: 'No appointment found for today.' });
    }
    res.json(appointment);
  } catch (error) {
    next(error);
  }
}

async function checkInAppointment(req, res, next) {
  try {
    const { id } = req.params;
    const { symptoms, temp, spo2, hr } = req.body;

    const appointment = await appointmentModel.getAppointmentById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appointment.status !== 'booked') {
      return res.status(400).json({ message: 'Appointment already processed' });
    }

    const finalSymptoms = symptoms || appointment.symptoms || null;

    const queueResult = await queueService.handleCheckIn({
      firstName: appointment.first_name,
      lastName: appointment.last_name,
      dateOfBirth: appointment.date_of_birth,
      phone: appointment.phone,
      symptoms: finalSymptoms,
      temp,
      spo2,
      hr
    });

    await appointmentModel.updateAppointmentCheckIn(id, { temp, spo2, hr });

    res.status(201).json({
      message: 'Check-in successful',
      queueNumber: queueResult.queueNumber,
      etaMinutes: queueResult.etaMinutes,
      queue: queueResult.queue
    });
  } catch (error) {
    next(error);
  }
}

async function getDailyAppointments(req, res, next) {
  try {
    const { date } = req.query;
    const searchDate = date || new Date().toISOString().split('T')[0];
    const appointments = await appointmentModel.getAppointmentsByDate(searchDate);
    res.json(appointments);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  bookAppointment,
  findMyAppointment,
  checkInAppointment,
  getDailyAppointments
};