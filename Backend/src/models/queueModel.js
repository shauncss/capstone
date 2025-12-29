const db = require('../db/knex');

async function enqueuePatient(entry) {
  const [record] = await db('queue').insert(entry).returning('*');
  return record;
}

async function getQueueLength() {
  const result = await db('queue').whereIn('status', ['waiting', 'called']).count('* as count');
  return Number(result[0]?.count || 0);
}

async function getCurrentQueueSnapshot() {
  return db('queue as q')
    .leftJoin('patients as p', 'q.patient_id', 'p.id')
    .leftJoin('rooms as r', 'q.assigned_room_id', 'r.id')
    .select(
      'q.id as queue_id',
      'q.queue_number',
      'q.status',
      'q.created_at',
      'q.assigned_room_id',
      'p.id as patient_id',
      'p.first_name',
      'p.last_name',
      'p.symptoms',
      'p.eta_minutes',
      'p.temp',
      'p.spo2',
      'p.hr',
      'r.name as room_name'
    )
    .whereIn('q.status', ['waiting', 'called'])
    .orderBy('q.created_at', 'asc');
}

async function updateQueueStatus(queueId, status) {
  const [record] = await db('queue').where({ id: queueId }).update({ status, updated_at: db.fn.now() }).returning('*');
  return record;
}

async function assignRoom(queueId, roomId) {
  const [record] = await db('queue')
    .where({ id: queueId })
    .update({ assigned_room_id: roomId, status: 'called', updated_at: db.fn.now() })
    .returning('*');
  return record;
}

async function getActiveQueueByRoom(roomId) {
  return db('queue')
    .where({ assigned_room_id: roomId })
    .whereIn('status', ['called'])
    .orderBy('updated_at', 'desc')
    .first();
}

async function getNextWaitingEntry() {
  return db('queue')
    .where({ status: 'waiting' })
    .orderBy('created_at', 'asc')
    .first();
}

async function completeQueueEntry(queueId) {
  const [record] = await db('queue')
    .where({ id: queueId })
    .update({ status: 'completed', updated_at: db.fn.now() })
    .returning('*');
  return record;
}

async function getCompletedQueueHistory({ limit = 100, offset = 0 }) {
  return db('queue as q')
    .leftJoin('patients as p', 'q.patient_id', 'p.id')
    .leftJoin('rooms as r', 'q.assigned_room_id', 'r.id')
    .select(
      'q.id as queue_id',
      'q.queue_number',
      'q.status',
      'q.created_at',
      'q.updated_at as completed_at',
      'p.first_name',
      'p.last_name',
      'p.symptoms',
      'r.name as room_name'
    )
    .where('q.status', 'completed')
    .orderBy('q.updated_at', 'desc')
    .limit(limit)
    .offset(offset);
}

module.exports = {
  enqueuePatient,
  getQueueLength,
  getCurrentQueueSnapshot,
  updateQueueStatus,
  assignRoom,
  getActiveQueueByRoom,
  getNextWaitingEntry,
  completeQueueEntry,
  getCompletedQueueHistory
};
