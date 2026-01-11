const roomModel = require('../models/roomModel');
const queueService = require('../services/queueService');

async function getRooms(_req, res, next) {
  try {
    const rooms = await roomModel.getRooms();
    return res.json({ rooms });
  } catch (error) {
    next(error);
  }
}

async function assignRoom(req, res, next) {
  try {
    const { queueId, roomId } = req.body;
    if (!queueId || !roomId) {
      return res.status(400).json({ message: 'queueId and roomId are required' });
    }
    const result = await queueService.assignRoomToQueue(queueId, roomId);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

async function finishRoom(req, res, next) {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ message: 'roomId is required' });
    }
    const result = await queueService.finishRoom(roomId);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

async function autoAssign(_req, res, next) {
  try {
    const result = await queueService.autoAssignNextAvailable();
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
}

async function updateRoomDetails(req, res, next) {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }
    const updated = await roomModel.updateRoom(id, { name: name.trim() });
    await queueService.broadcastRooms();
    return res.json({ room: updated });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Room name must be unique' });
    }
    next(error);
  }
}

module.exports = {
  getRooms,
  assignRoom,
  finishRoom,
  autoAssign,
  updateRoomDetails
};