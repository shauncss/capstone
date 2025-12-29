const express = require('express');
const queueController = require('../controllers/queueController');

const router = express.Router();

router.get('/queue/current', queueController.getCurrentQueue);
router.get('/waittime/estimate', queueController.getEta);
router.get('/queue/history', queueController.getHistory);

module.exports = router;
