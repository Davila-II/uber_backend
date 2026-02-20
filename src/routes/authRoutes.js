const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/request-otp', authController.requestOTP);
router.post('/verify-otp', authController.verifyOTP);

module.exports = router;