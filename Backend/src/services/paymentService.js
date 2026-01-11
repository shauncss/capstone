const paymentQueueModel = require('../models/paymentQueueModel');
const socketService = require('./socketService');
const pharmacyService = require('./pharmacyService'); // Import Pharmacy Service

async function broadcastPaymentQueue() {
  const queue = await paymentQueueModel.getCurrentQueueSnapshot();
  socketService.emit('payment_update', queue);
  return queue;
}

async function enqueueFromQueueRecord(queueRecord) {
  if (!queueRecord) return null;
  const entry = await paymentQueueModel.enqueue({
    queue_id: queueRecord.id,
    patient_id: queueRecord.patient_id || null,
    queue_number: queueRecord.queue_number
  });
  await broadcastPaymentQueue();
  return entry;
}

async function getCurrentQueue() {
  return paymentQueueModel.getCurrentQueueSnapshot();
}

async function callNextPatient() {
  const next = await paymentQueueModel.getNextWaitingEntry();
  if (!next) {
    const error = new Error('No payment patients waiting');
    error.statusCode = 409;
    throw error;
  }
  const updated = await paymentQueueModel.updateStatus(next.id, 'ready');
  await broadcastPaymentQueue();
  return updated;
}

async function completePatient(id) {
  // 1. Mark Payment as Complete
  const updated = await paymentQueueModel.markComplete(id);
  if (!updated) {
    const error = new Error('Payment queue entry not found');
    error.statusCode = 404;
    throw error;
  }
  
  // 2. MOVE TO PHARMACY QUEUE AUTOMATICALLY
  // We pass the payment record structure which has the same queue_id/patient_id fields
  await pharmacyService.enqueueFromQueueRecord({
    id: updated.queue_id,
    patient_id: updated.patient_id,
    queue_number: updated.queue_number
  });

  await broadcastPaymentQueue();
  return updated;
}

module.exports = {
  broadcastPaymentQueue,
  enqueueFromQueueRecord,
  getCurrentQueue,
  callNextPatient,
  completePatient
};