const roomModel = require('../models/roomModel');
const queueService = require('../services/queueService');

async function getRooms(req, res, next) {
  try {
    const rooms = await roomModel.getRooms();
    return res.json({ rooms });
  } catch (error) {
    next(error);
  }
}

async function addRoom(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }
    const room = await roomModel.addRoom({ name });
    await queueService.broadcastRooms();
    return res.status(201).json({ room });
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

async function autoAssign(req, res, next) {
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

async function removeRoom(req, res, next) {
  try {
    const { id } = req.params;
    const room = await roomModel.getRoomById(id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (!room.is_available) {
      return res.status(409).json({ message: 'Cannot delete a room that is in use' });
    }
    await roomModel.deleteRoom(id);
    await queueService.broadcastRooms();
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRooms,
  addRoom,
  assignRoom,
  finishRoom,
  autoAssign,
  updateRoomDetails,
  removeRoom
};
