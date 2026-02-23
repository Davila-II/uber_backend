const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration de Multer : où ranger les images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/';
        // Si le dossier n'existe pas, on le crée
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- ROUTES CLIENTS ---
router.post('/register', authController.register);
router.post('/request-otp', authController.requestOTP);
router.post('/verify-otp', authController.verifyOTP);

// --- ROUTES CHAUFFEURS (PRO) ---
router.post('/driver/register', authController.registerDriver);
router.post('/driver/verify-otp', authController.verifyDriverOTP);

// ✅ ICI : On utilise upload.fields pour dire à Multer d'attendre ces 4 images précisément
router.post('/driver/complete-profile', upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'id_card', maxCount: 1 },
    { name: 'vehicle_photo', maxCount: 1 }
]), authController.completeDriverProfile);

module.exports = router;