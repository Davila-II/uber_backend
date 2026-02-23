const axios = require('axios');
const db = require('../config/db'); 

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// ==========================================
// SECTION CLIENTS (APPLICATION UTILISATEUR)
// ==========================================

exports.register = async (req, res) => {
    const { phone, name, email } = req.body;
    if (!phone || !name || !email) {
        return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires" });
    }
    try {
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Ce numéro est déjà utilisé" });
        }
        await db.query(
            'INSERT INTO users (phone, name, email) VALUES ($1, $2, $3)',
            [phone, name, email]
        );
        res.status(201).json({ success: true, message: "Compte créé avec succès !" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Erreur lors de l'inscription" });
    }
};

exports.requestOTP = async (req, res) => {
    const { phone } = req.body;
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    try {
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Ce numéro n'est pas enregistré." });
        }
        const user = userCheck.rows[0];
        await db.query('UPDATE users SET otp_code = $1 WHERE phone = $2', [otpCode, phone]);

        try {
            await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Uber CM", email: "daviladutau@gmail.com" },
                to: [{ email: user.email, name: user.name }],
                subject: "Votre code Uber CM",
                htmlContent: `<h4>Bonjour ${user.name},</h4><p>Votre code est : <strong>${otpCode}</strong></p>`
            }, {
                headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
            });
        } catch (emailErr) { console.error("⚠️ Brevo:", emailErr.message); }

        res.status(200).json({ success: true, message: "Code envoyé" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Erreur technique" });
    }
};

exports.verifyOTP = async (req, res) => {
    const { phone, code } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE phone = $1 AND otp_code = $2', [phone, code]);
        if (result.rows.length > 0) {
            await db.query('UPDATE users SET otp_code = NULL WHERE phone = $1', [phone]);
            return res.status(200).json({ success: true, message: "Vérification réussie" });
        } else {
            return res.status(400).json({ success: false, message: "Code incorrect" });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

// ==========================================
// SECTION CHAUFFEURS (APPLICATION PRO)
// ==========================================

exports.registerDriver = async (req, res) => {
    const { name, email, phone, city, referral_code } = req.body;
    console.log("📩 Requête reçue pour inscription chauffeur:", email);

    // FIX: Génération correcte du code
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
        // 1. Vérifier si l'email existe déjà
        const check = await db.query('SELECT * FROM chauffeurs WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Cet email est déjà utilisé" });
        }

        // 2. Insertion avec la bonne variable generatedOtp
        await db.query(
            'INSERT INTO chauffeurs (name, email, phone, city, referral_code, otp_code) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, email, phone, city, referral_code, generatedOtp]
        );

        // 3. Envoi via Brevo
        try {
            await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Uber CM Pro", email: "daviladutau@gmail.com" },
                to: [{ email: email, name: name }],
                subject: "Vérification Chauffeur Uber CM Pro",
                htmlContent: `<h4>Bienvenue ${name},</h4><p>Votre code chauffeur est : <strong>${generatedOtp}</strong></p>`
            }, {
                headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
            });
        } catch (e) { 
            console.error("⚠️ Brevo Chauffeur Error:", e.response ? e.response.data : e.message); 
        }

        return res.status(201).json({ success: true, message: "Chauffeur créé, code envoyé." });

    } catch (err) {
        console.error("❌ Register Driver Error:", err.message);
        return res.status(500).json({ 
            success: false, 
            message: "DEBUG_SERVER: " + err.message 
        });
    }
};

exports.verifyDriverOTP = async (req, res) => {
    const { email, code } = req.body;
    try {
        const result = await db.query(
            'SELECT * FROM chauffeurs WHERE email = $1 AND otp_code = $2',
            [email, code]
        );

        if (result.rows.length > 0) {
            await db.query('UPDATE chauffeurs SET is_verified = true, otp_code = NULL WHERE email = $1', [email]);
            return res.status(200).json({ success: true, message: "Compte vérifié avec succès" });
        } else {
            return res.status(400).json({ success: false, message: "Code incorrect" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};
