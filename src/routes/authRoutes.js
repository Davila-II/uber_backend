const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// --- ROUTES CLIENTS ---
router.post('/register', authController.register);
router.post('/request-otp', authController.requestOTP);
router.post('/verify-otp', authController.verifyOTP);

// --- ROUTES CHAUFFEURS (PRO) ---
router.post('/driver/register', authController.registerDriver);
router.post('/driver/verify-otp', authController.verifyDriverOTP);

module.exports = router;