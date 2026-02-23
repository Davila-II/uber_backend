const axios = require('axios');
const db = require('../config/db'); 

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// ==========================================
// SECTION CLIENTS
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
        await db.query('INSERT INTO users (phone, name, email) VALUES ($1, $2, $3)', [phone, name, email]);
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
        if (userCheck.rows.length === 0) return res.status(404).json({ success: false, message: "Non enregistré." });
        const user = userCheck.rows[0];
        await db.query('UPDATE users SET otp_code = $1 WHERE phone = $2', [otpCode, phone]);
        try {
            await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Uber CM", email: "daviladutau@gmail.com" },
                to: [{ email: user.email, name: user.name }],
                subject: "Votre code Uber CM",
                htmlContent: `<h4>Code : ${otpCode}</h4>`
            }, { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } });
        } catch (e) { console.error(e.message); }
        res.status(200).json({ success: true, message: "Code envoyé" });
    } catch (err) { res.status(500).json({ success: false, message: "Erreur technique" }); }
};

exports.verifyDriverOTP = async (req, res) => {
    const { email, code } = req.body;
    try {
        const result = await db.query('SELECT * FROM chauffeurs WHERE email = $1 AND otp_code = $2', [email, code]);
        
        if (result.rows.length > 0) {
            const driver = result.rows[0];
            // On vérifie si la colonne 'brand' est remplie pour savoir si le profil est complet
            const isProfileComplete = driver.brand !== null;

            await db.query('UPDATE chauffeurs SET is_verified = true, otp_code = NULL WHERE email = $1', [email]);
            
            return res.status(200).json({ 
                success: true, 
                message: "Vérifié",
                isProfileComplete: isProfileComplete // On envoie l'info à Flutter
            });
        }
        return res.status(400).json({ success: false, message: "Code incorrect" });
    } catch (err) { res.status(500).json({ success: false, message: "Erreur" }); }
};

// ==========================================
// SECTION CHAUFFEURS (PRO)
// ==========================================

exports.registerDriver = async (req, res) => {
    const { name, email, phone, city, referral_code } = req.body;
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const check = await db.query('SELECT * FROM chauffeurs WHERE email = $1', [email]);
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
                htmlContent: `<h4>Code : ${generatedOtp}</h4>`
            }, { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } });
        } catch (e) { console.error(e.message); }

        return res.status(201).json({ success: true, message: "Chauffeur créé." });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.verifyDriverOTP = async (req, res) => {
    const { email, code } = req.body;
    try {
        const result = await db.query('SELECT * FROM chauffeurs WHERE email = $1 AND otp_code = $2', [email, code]);
        if (result.rows.length > 0) {
            await db.query('UPDATE chauffeurs SET is_verified = true, otp_code = NULL WHERE email = $1', [email]);
            return res.status(200).json({ success: true, message: "Vérifié" });
        }
        return res.status(400).json({ success: false, message: "Code incorrect" });
    } catch (err) { res.status(500).json({ success: false, message: "Erreur" }); }
};

exports.loginDriver = async (req, res) => {
    const { email } = req.body;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const result = await db.query('SELECT * FROM chauffeurs WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Aucun compte trouvé avec cet email" });
        }

        // On met à jour le code OTP en base
        await db.query('UPDATE chauffeurs SET otp_code = $1 WHERE email = $2', [otpCode, email]);

        // Envoi de l'email via Brevo
        try {
            await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Uber CM Pro", email: "daviladutau@gmail.com" },
                to: [{ email: email }],
                subject: "Votre code de connexion Uber CM Pro",
                htmlContent: `<p>Votre code de connexion est : <strong>${otpCode}</strong></p>`
            }, { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } });
        } catch (e) { console.error("Brevo Error:", e.message); }

        res.status(200).json({ success: true, message: "Code envoyé" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ✅ NOUVELLE FONCTION : Finalisation du profil (Véhicule + Documents)
exports.completeDriverProfile = async (req, res) => {
    try {
        const { email, brand, model, year, color, plate } = req.body;
        
        // Les fichiers sont dans req.files grâce à multer
        const licensePath = req.files['license'] ? req.files['license'][0].path : null;
        const insurancePath = req.files['insurance'] ? req.files['insurance'][0].path : null;
        const idCardPath = req.files['id_card'] ? req.files['id_card'][0].path : null;
        const vehiclePhotoPath = req.files['vehicle_photo'] ? req.files['vehicle_photo'][0].path : null;

        console.log("Données reçues pour :", email);
        console.log("Fichiers enregistrés dans /uploads/");

        // Mise à jour de la base de données (Assure-toi que ces colonnes existent dans ta table chauffeurs)
        const query = `
            UPDATE chauffeurs 
            SET brand = $1, model = $2, year = $3, color = $4, plate = $5, 
                license_img = $6, insurance_img = $7, id_card_img = $8, vehicle_img = $9
            WHERE email = $10
        `;
        
        await db.query(query, [
            brand, model, year, color, plate, 
            licensePath, insurancePath, idCardPath, vehiclePhotoPath, 
            email
        ]);

        res.status(200).json({ success: true, message: "Profil et documents enregistrés !" });

    } catch (err) {
        console.error("❌ Erreur complete-profile:", err.message);
        res.status(500).json({ success: false, message: "Erreur serveur : " + err.message });
    }
};
