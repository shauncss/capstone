const appointmentModel = require('../models/appointmentModel');
const queueService = require('../services/queueService');

// 1. Book a new slot
async function bookAppointment(req, res, next) {
  try {
    const { firstName, lastName, phone, appointmentTime } = req.body;
    
    if (!firstName || !lastName || !appointmentTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const appointment = await appointmentModel.createAppointment({
      first_name: firstName,
      last_name: lastName,
      phone,
      appointment_time: appointmentTime,
      status: 'booked'
    });

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
}

// 2. Get appointments (e.g., for Admin Dashboard)
async function getDailyAppointments(req, res, next) {
  try {
    const { date } = req.query; // Expects ?date=YYYY-MM-DD
    const searchDate = date || new Date().toISOString().split('T')[0];
    
    const appointments = await appointmentModel.getAppointmentsByDate(searchDate);
    res.json(appointments);
  } catch (error) {
    next(error);
  }
}

// 3. Find appointment by phone (for Kiosk "I have an appointment")
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

// 4. Check-in (Convert Appointment -> Live Queue)
async function checkInAppointment(req, res, next) {
  try {
    const { id } = req.params;
    const { symptoms, temp, spo2, hr } = req.body; // Optional vitals from kiosk

    // A. Get existing appointment
    const appointment = await appointmentModel.getAppointmentById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appointment.status !== 'booked') {
      return res.status(400).json({ message: 'Appointment already processed' });
    }

    // B. Add to Live Queue (Reusing your existing queue logic!)
    // We merge the saved name/phone with the live vitals/symptoms
    const queueResult = await queueService.handleCheckIn({
      firstName: appointment.first_name,
      lastName: appointment.last_name,
      phone: appointment.phone,
      symptoms: symptoms || 'Scheduled Visit', // Default if empty
      temp,
      spo2,
      hr
    });

    // C. Mark appointment as checked_in so it can't be used again
    await appointmentModel.updateStatus(id, 'checked_in');

    res.status(201).json({
      message: 'Check-in successful',
      queue: queueResult
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  bookAppointment,
  getDailyAppointments,
  findMyAppointment,
  checkInAppointment
};