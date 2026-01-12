// Backend/src/models/appointmentModel.js
const db = require('../db/knex');

async function createAppointment(appointment) {
  const [record] = await db('appointments').insert(appointment).returning('*');
  return record;
}

async function getAppointmentByPhone(phone) {
  // Finds today's active booking for this phone number
  const today = new Date().toISOString().split('T')[0];
  
  // Note: We use raw SQL for date matching to be safe across different DBs
  return db('appointments')
    .where('phone', 'like', `%${phone}%`)
    .whereRaw('DATE(appointment_time) = ?', [today]) 
    .where('status', 'booked')
    .first();
}

async function getAppointmentById(id) {
  return db('appointments').where({ id }).first();
}

async function updateStatus(id, status) {
  const [record] = await db('appointments')
    .where({ id })
    .update({ status })
    .returning('*');
  return record;
}

async function getAppointmentsByDate(dateString) {
  return db('appointments')
    .whereRaw('DATE(appointment_time) = ?', [dateString])
    .orderBy('appointment_time', 'asc');
}

module.exports = {
  createAppointment,
  getAppointmentByPhone,
  getAppointmentById,
  updateStatus,
  getAppointmentsByDate
};