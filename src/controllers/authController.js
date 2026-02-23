const axios = require('axios');
const db = require('../config/db'); 

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// ==========================================
// --- PARTIE CHAUFFEURS (PRO) ---
// ==========================================

exports.registerDriver = async (req, res) => {
    const { name, email, phone, city, referral_code } = req.body;
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const check = await db.query('SELECT * FROM chauffeurs WHERE LOWER(email) = LOWER($1)', [email]);
        if (check.rows.length > 0) return res.status(400).json({ success: false, message: "Email déjà utilisé" });
        
        await db.query(
            'INSERT INTO chauffeurs (name, email, phone, city, referral_code, otp_code) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, email, phone, city, referral_code, generatedOtp]
        );

        try {
            await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Uber CM Pro", email: "daviladutau@gmail.com" },
                to: [{ email, name }],
                subject: "Vérification Chauffeur",
                htmlContent: `<h4>Votre code : ${generatedOtp}</h4>`
            }, { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } });
        } catch (e) { console.error("Brevo Error:", e.message); }

        return res.status(201).json({ success: true, message: "Chauffeur créé." });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.loginDriver = async (req, res) => {
    const { email } = req.body;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const result = await db.query('SELECT * FROM chauffeurs WHERE LOWER(email) = LOWER($1)', [email]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Aucun compte trouvé" });

        const realEmail = result.rows[0].email;
        await db.query('UPDATE chauffeurs SET otp_code = $1 WHERE email = $2', [otpCode, realEmail]);

        try {
            await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Uber CM Pro", email: "daviladutau@gmail.com" },
                to: [{ email: realEmail }],
                subject: "Connexion Uber CM Pro",
                htmlContent: `<p>Votre code : <strong>${otpCode}</strong></p>`
            }, { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } });
        } catch (e) { console.error("Brevo Error:", e.message); }

        res.status(200).json({ success: true, message: "Code envoyé" });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.verifyDriverOTP = async (req, res) => {
    const { email, code } = req.body;
    try {
        const result = await db.query('SELECT * FROM chauffeurs WHERE LOWER(email) = LOWER($1) AND otp_code = $2', [email, code]);
        if (result.rows.length > 0) {
            const driver = result.rows[0];
            const isProfileComplete = driver.brand !== null && driver.brand !== "";
            await db.query('UPDATE chauffeurs SET is_verified = true, otp_code = NULL WHERE email = $1', [driver.email]);
            return res.status(200).json({ success: true, isProfileComplete: isProfileComplete });
        }
        return res.status(400).json({ success: false, message: "Code incorrect" });
    } catch (err) { res.status(500).json({ success: false, message: "Erreur serveur" }); }
};

exports.completeDriverProfile = async (req, res) => {
    try {
        const { email, brand, model, year, color, plate } = req.body;
        const licensePath = req.files['license']?.[0]?.path || null;
        const insurancePath = req.files['insurance']?.[0]?.path || null;
        const idCardPath = req.files['id_card']?.[0]?.path || null;
        const vehiclePhotoPath = req.files['vehicle_photo']?.[0]?.path || null;

        await db.query(`
            UPDATE chauffeurs SET brand=$1, model=$2, year=$3, color=$4, plate=$5, 
            license_img=$6, insurance_img=$7, id_card_img=$8, vehicle_img=$9 WHERE LOWER(email)=LOWER($10)`,
            [brand, model, year, color, plate, licensePath, insurancePath, idCardPath, vehiclePhotoPath, email]
        );
        res.status(200).json({ success: true, message: "Profil complété !" });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ==========================================
// --- PARTIE CLIENTS (PASSAGERS) ---
// ==========================================

exports.register = async (req, res) => {
    const { name, email, phone } = req.body;
    try {
        const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (check.rows.length > 0) return res.status(400).json({ message: "Email déjà utilisé" });

        await db.query('INSERT INTO users (name, email, phone) VALUES ($1, $2, $3)', [name, email, phone]);
        res.status(201).json({ success: true, message: "Client créé" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.requestOTP = async (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        await db.query('UPDATE users SET otp_code = $1 WHERE email = $2', [otp, email]);
        // Logique d'envoi mail Brevo identique à celle du chauffeur...
        res.status(200).json({ success: true, message: "OTP envoyé" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.verifyOTP = async (req, res) => {
    const { email, code } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1 AND otp_code = $2', [email, code]);
        if (result.rows.length > 0) {
            await db.query('UPDATE users SET is_verified = true WHERE email = $1', [email]);
            return res.status(200).json({ success: true });
        }
        res.status(400).json({ message: "Code erroné" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};