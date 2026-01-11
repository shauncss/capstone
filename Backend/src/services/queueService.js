const patientModel = require('../models/patientModel');
const queueModel = require('../models/queueModel');
const roomModel = require('../models/roomModel');
const { calculateEta } = require('../utils/etaCalculator');
const { generateNextQueueNumber } = require('../utils/queueNumber'); 
const socketService = require('./socketService');
const pharmacyService = require('./pharmacyService');

async function broadcastQueue() {
  const queue = await queueModel.getCurrentQueueSnapshot();
  socketService.emit('queue_update', queue);
  return queue;
}

async function broadcastRooms() {
  const rooms = await roomModel.getRooms();
  socketService.emit('room_update', rooms);
  return rooms;
}

async function handleCheckIn({
  firstName,
  lastName,
  dateOfBirth,
  phone,
  symptoms,
  temp,
  spo2,
  hr
}) {
  const normalizedDob = dateOfBirth && String(dateOfBirth).trim() !== '' ? dateOfBirth : null;
  const normalizedTemp = temp !== undefined && temp !== null && temp !== '' ? Number(temp) : null;
  const normalizedSpo2 = spo2 !== undefined && spo2 !== null && spo2 !== '' ? Number(spo2) : null;
  const normalizedHr = hr !== undefined && hr !== null && hr !== '' ? Number(hr) : null;
  
  const queueLength = await queueModel.getQueueLength();

  // --- CHANGED LOGIC START ---
  // 1. Get the last created queue entry from DB
  const lastEntry = await queueModel.getLastQueueEntry();
  // 2. Extract the number string (or null if DB is empty)
  const lastQueueNumber = lastEntry ? lastEntry.queue_number : null;
  // 3. Generate the next number
  const queueNumber = generateNextQueueNumber(lastQueueNumber);
  // --- CHANGED LOGIC END ---

  const etaMinutes = calculateEta(queueLength);

  const patient = await patientModel.createPatient({
    first_name: firstName,
    last_name: lastName,
    date_of_birth: normalizedDob,
    phone,
    symptoms,
    temp: normalizedTemp,
    spo2: normalizedSpo2,
    hr: normalizedHr,
    queue_number: queueNumber,
    eta_minutes: etaMinutes
  });

  await queueModel.enqueuePatient({
    patient_id: patient.id,
    queue_number: queueNumber,
    status: 'waiting'
  });

  const queue = await broadcastQueue();
  socketService.emit('new_patient', { patient, queueNumber, etaMinutes });

  return { patient, queueNumber, etaMinutes, queue };
}

async function getCurrentQueue() {
  return queueModel.getCurrentQueueSnapshot();
}

async function getEtaPreview() {
  const queueLength = await queueModel.getQueueLength();
  return {
    queueLength,
    etaMinutes: calculateEta(queueLength)
  };
}

async function assignRoomToQueue(queueId, roomId) {
  const queueRecord = await queueModel.assignRoom(queueId, roomId);
  if (!queueRecord) {
    throw new Error('Queue entry not found');
  }
  if (queueRecord?.patient_id) {
    await patientModel.updatePatient(queueRecord.patient_id, { room_id: roomId });
  }
  const room = await roomModel.updateRoom(roomId, {
    current_patient_id: queueRecord?.patient_id || null,
    is_available: false
  });

  await broadcastQueue();
  await broadcastRooms();

  return { queueRecord, room };
}

async function finishRoom(roomId) {
  const activeQueue = await queueModel.getActiveQueueByRoom(roomId);
  if (activeQueue) {
    const completed = await queueModel.completeQueueEntry(activeQueue.id);
    if (activeQueue.patient_id) {
      await patientModel.updatePatient(activeQueue.patient_id, { room_id: null });
    }
    await pharmacyService.enqueueFromQueueRecord(completed);
  }

  const room = await roomModel.updateRoom(roomId, {
    current_patient_id: null,
    is_available: true
  });

  await broadcastQueue();
  await broadcastRooms();
  await pharmacyService.broadcastPharmacyQueue();

  return { room, finishedQueueId: activeQueue?.id || null };
}

async function autoAssignNextAvailable() {
  const [nextQueue, availableRoom] = await Promise.all([
    queueModel.getNextWaitingEntry(),
    roomModel.getFirstAvailableRoom()
  ]);

  if (!nextQueue) {
    const error = new Error('No waiting patients to assign');
    error.statusCode = 409;
    throw error;
  }

  if (!availableRoom) {
    const error = new Error('No rooms available to assign');
    error.statusCode = 409;
    throw error;
  }

  return assignRoomToQueue(nextQueue.id, availableRoom.id);
}

async function getQueueHistory({ limit, page }) {
  const numericLimit = Number(limit);
  const cappedLimit = Number.isFinite(numericLimit) ? Math.min(Math.max(numericLimit, 1), 200) : 100;
  const numericPage = Number(page);
  const normalizedPage = Number.isFinite(numericPage) && numericPage > 0 ? Math.floor(numericPage) : 1;
  const offset = (normalizedPage - 1) * cappedLimit;

  const rows = await queueModel.getCompletedQueueHistory({ limit: cappedLimit + 1, offset });
  const hasMore = rows.length > cappedLimit;
  const history = hasMore ? rows.slice(0, cappedLimit) : rows;

  return {
    history,
    pagination: {
      page: normalizedPage,
      limit: cappedLimit,
      hasMore
    }
  };
}

module.exports = {
  handleCheckIn,
  getCurrentQueue,
  getEtaPreview,
  assignRoomToQueue,
  broadcastQueue,
  broadcastRooms,
  finishRoom,
  autoAssignNextAvailable,
  getQueueHistory
};