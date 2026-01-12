const db = require('../db/knex');

async function createAppointment(appointment) {
  const [record] = await db('appointments').insert(appointment).returning('*');
  return record;
}

async function getAppointmentsByDate(dateString) {
  // Assumes dateString is YYYY-MM-DD
  // We filter where appointment_time starts with that date
  return db('appointments')
    .whereRaw('DATE(appointment_time) = ?', [dateString])
    .orderBy('appointment_time', 'asc');
}

async function getAppointmentById(id) {
  return db('appointments').where({ id }).first();
}

async function getAppointmentByPhone(phone) {
  // Helper to find today's appointments by phone for check-in
  const today = new Date().toISOString().split('T')[0];
  return db('appointments')
    .where('phone', 'like', `%${phone}%`)
    .andWhereRaw('DATE(appointment_time) = ?', [today])
    .where('status', 'booked') // Only find active bookings
    .first();
}

async function updateStatus(id, status) {
  const [record] = await db('appointments')
    .where({ id })
    .update({ status })
    .returning('*');
  return record;
}

module.exports = {
  createAppointment,
  getAppointmentsByDate,
  getAppointmentById,
  getAppointmentByPhone,
  updateStatus
};