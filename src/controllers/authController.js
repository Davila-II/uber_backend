const axios = require('axios');
const db = require('../config/db'); 

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// --- INSCRIPTION (Création de compte) ---
exports.register = async (req, res) => {
    const { phone, name, email } = req.body;

    if (!phone || !name || !email) {
        return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires" });
    }

    try {
        // Vérifier si l'utilisateur existe déjà
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Ce numéro est déjà utilisé" });
        }

        // Insérer le nouvel utilisateur
        await db.query(
            'INSERT INTO users (phone, name, email) VALUES ($1, $2, $3)',
            [phone, name, email]
        );

        console.log(`👤 Nouvel utilisateur créé : ${name} (${phone})`);
        res.status(201).json({ success: true, message: "Compte créé avec succès ! Connectez-vous." });

    } catch (err) {
        console.error("❌ Erreur Register:", err.message);
        res.status(500).json({ success: false, message: "Erreur lors de l'inscription" });
    }
};

// --- DEMANDE D'OTP (Connexion) ---
exports.requestOTP = async (req, res) => {
    const { phone } = req.body;
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Ce numéro n'est pas enregistré." 
            });
        }

        const user = userCheck.rows[0];
        
        // Mise à jour de l'OTP
        await db.query('UPDATE users SET otp_code = $1 WHERE phone = $2', [otpCode, phone]);

        // Envoi Email via Brevo
        try {
            await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Uber CM", email: "daviladutau@gmail.com" },
                to: [{ email: user.email, name: user.name }],
                subject: "Votre code Uber CM",
                htmlContent: `<h4>Bonjour ${user.name},</h4><p>Votre code est : <strong>${otpCode}</strong></p>`
            }, {
                headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
            });
        } catch (emailErr) {
            console.error("⚠️ Erreur Brevo:", emailErr.message);
        }

        res.status(200).json({ success: true, message: "Code envoyé" });

    } catch (err) {
        res.status(500).json({ success: false, message: "Erreur technique" });
    }
};

// --- VÉRIFICATION OTP ---
exports.verifyOTP = async (req, res) => {
    const { phone, code } = req.body;
    try {
        const result = await db.query(
            'SELECT * FROM users WHERE phone = $1 AND otp_code = $2',
            [phone, code]
        );

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