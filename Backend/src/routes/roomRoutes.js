const express = require('express');
const roomController = require('../controllers/roomController');

const router = express.Router();

router.get('/rooms', roomController.getRooms);
router.post('/rooms/assign', roomController.assignRoom);
router.post('/rooms/finish', roomController.finishRoom);
router.post('/rooms/auto-assign', roomController.autoAssign);

module.exports = router;