const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/payment/queue', paymentController.getQueue);
router.post('/payment/call-next', paymentController.callNext);
router.post('/payment/complete', paymentController.complete);

module.exports = router;