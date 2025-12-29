const db = require('../db/knex');

async function logHeartbeat(payload) {
  const [record] = await db('sensor_logs').insert(payload).returning('*');
  return record;
}

async function getLatestStatus(piIdentifier) {
  return db('sensor_logs')
    .where({ pi_identifier: piIdentifier })
    .orderBy('created_at', 'desc')
    .first();
}

module.exports = {
  logHeartbeat,
  getLatestStatus
};
