const express = require('express');
const roomController = require('../controllers/roomController');

const router = express.Router();

router.get('/rooms', roomController.getRooms);
router.post('/rooms/add', roomController.addRoom);
router.post('/rooms/assign', roomController.assignRoom);
router.post('/rooms/finish', roomController.finishRoom);
router.post('/rooms/auto-assign', roomController.autoAssign);
router.patch('/rooms/:id', roomController.updateRoomDetails);
router.delete('/rooms/:id', roomController.removeRoom);

module.exports = router;
