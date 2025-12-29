const queueService = require('../services/queueService');
const roomModel = require('../models/roomModel');
const socketService = require('../services/socketService');
const pharmacyService = require('../services/pharmacyService');

function registerSocket(io) {
  socketService.attach(io);

  io.on('connection', async (socket) => {
    socket.emit('connected', { id: socket.id, timestamp: Date.now() });

    // Immediately provide latest queue and rooms to new clients
    const [queue, rooms, pharmacyQueue] = await Promise.all([
      queueService.getCurrentQueue(),
      roomModel.getRooms(),
      pharmacyService.getCurrentQueue()
    ]);
    socket.emit('queue_update', queue);
    socket.emit('room_update', rooms);
    socket.emit('pharmacy_update', pharmacyQueue);

    socket.on('disconnect', () => {
      // placeholder for cleanup/logging
    });
  });
}

module.exports = registerSocket;
