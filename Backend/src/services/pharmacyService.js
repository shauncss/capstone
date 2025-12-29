const pharmacyQueueModel = require('../models/pharmacyQueueModel');
const socketService = require('./socketService');

async function broadcastPharmacyQueue() {
  const queue = await pharmacyQueueModel.getCurrentQueueSnapshot();
  socketService.emit('pharmacy_update', queue);
  return queue;
}

async function enqueueFromQueueRecord(queueRecord) {
  if (!queueRecord) return null;
  if (!queueRecord.patient_id && !queueRecord.queue_number) return null;
  const entry = await pharmacyQueueModel.enqueue({
    queue_id: queueRecord.id,
    patient_id: queueRecord.patient_id || null,
    queue_number: queueRecord.queue_number
  });
  await broadcastPharmacyQueue();
  return entry;
}

async function getCurrentQueue() {
  return pharmacyQueueModel.getCurrentQueueSnapshot();
}

async function callNextPatient() {
  const next = await pharmacyQueueModel.getNextWaitingEntry();
  if (!next) {
    const error = new Error('No pharmacy patients waiting');
    error.statusCode = 409;
    throw error;
  }
  const updated = await pharmacyQueueModel.updateStatus(next.id, 'ready');
  await broadcastPharmacyQueue();
  return updated;
}

async function completePatient(id) {
  const updated = await pharmacyQueueModel.markComplete(id);
  if (!updated) {
    const error = new Error('Pharmacy queue entry not found');
    error.statusCode = 404;
    throw error;
  }
  await broadcastPharmacyQueue();
  return updated;
}

module.exports = {
  broadcastPharmacyQueue,
  enqueueFromQueueRecord,
  getCurrentQueue,
  callNextPatient,
  completePatient
};
