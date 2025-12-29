const db = require('../db/knex');

async function enqueue({ queue_id, patient_id, queue_number }) {
  const existing = await db('pharmacy_queue').where({ queue_id }).first();
  if (existing) return existing;
  const [record] = await db('pharmacy_queue').insert({ queue_id, patient_id, queue_number }).returning('*');
  return record;
}

async function getCurrentQueueSnapshot() {
  return db('pharmacy_queue as pq')
    .leftJoin('patients as p', 'pq.patient_id', 'p.id')
    .select(
      'pq.id as pharmacy_id',
      'pq.queue_id',
      'pq.queue_number',
      'pq.status',
      'pq.called_at',
      'pq.created_at',
      'p.first_name',
      'p.last_name',
      'p.symptoms'
    )
    .whereIn('pq.status', ['waiting', 'ready'])
    .orderBy('pq.created_at', 'asc');
}

async function getNextWaitingEntry() {
  return db('pharmacy_queue').where({ status: 'waiting' }).orderBy('created_at', 'asc').first();
}

async function updateStatus(id, status) {
  const updates = { status, updated_at: db.fn.now() };
  if (status === 'ready') {
    updates.called_at = db.fn.now();
  }
  const [record] = await db('pharmacy_queue').where({ id }).update(updates).returning('*');
  return record;
}

async function markComplete(id) {
  return updateStatus(id, 'completed');
}

module.exports = {
  enqueue,
  getCurrentQueueSnapshot,
  getNextWaitingEntry,
  updateStatus,
  markComplete
};
