const express = require('express');
const pharmacyController = require('../controllers/pharmacyController');

const router = express.Router();

router.get('/pharmacy/queue', pharmacyController.getQueue);
router.post('/pharmacy/call-next', pharmacyController.callNext);
router.post('/pharmacy/complete', pharmacyController.complete);

module.exports = router;
