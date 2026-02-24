const axios = require('axios');
const db = require('../config/db'); 

const BREVO_API_KEY = process.env.BREVO_API_KEY;

/**
 * Fonction utilitaire pour envoyer des emails via Brevo
 * Centraliser l'envoi permet de mieux diagnostiquer les erreurs
 */
const sendEmail = async (toEmail, subject, htmlContent) => {
    try {
        if (!BREVO_API_KEY) {
            console.error("❌ ERREUR : BREVO_API_KEY est manquante dans Railway (Variables).");
            return false;
        }

        const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: "Uber CM", email: "daviladutau@gmail.com" },
            to: [{ email: toEmail }],
            subject: subject,
            htmlContent: htmlContent
        }, { 
            headers: { 
                'api-key': BREVO_API_KEY, 
                'Content-Type': 'application/json' 
            } 
        });
        
        console.log(`✅ Mail envoyé avec succès à ${toEmail}. ID: ${response.data.messageId}`);
        return true;
    } catch (e) {
        console.error("❌ Erreur Brevo lors de l'envoi :");
        if (e.response) {
            console.error("Détails :", JSON.stringify(e.response.data));
        } else {
            console.error("Message :", e.message);
        }
        return false;
    }
};

// ==========================================
// --- PARTIE CHAUFFEURS (PRO) ---
// ==========================================

exports.registerDriver = async (req, res) => {
    const { name, email, phone, city, referral_code } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const check = await db.query('SELECT * FROM chauffeurs WHERE LOWER(email) = LOWER($1)', [email]);
        if (check.rows.length > 0) return res.status(400).json({ success: false, message: "Email déjà utilisé" });
        
        await db.query(
            'INSERT INTO chauffeurs (name, email, phone, city, referral_code, otp_code) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, email, phone, city, referral_code, otp]
        );

        await sendEmail(email, "Vérification Chauffeur Uber CM Pro", `<h4>Votre code : ${otp}</h4>`);

        return res.status(201).json({ success: true, message: "Chauffeur créé." });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.loginDriver = async (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const result = await db.query('SELECT * FROM chauffeurs WHERE LOWER(email) = LOWER($1)', [email]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Aucun compte trouvé" });

        const realEmail = result.rows[0].email;
        await db.query('UPDATE chauffeurs SET otp_code = $1 WHERE email = $2', [otp, realEmail]);

        await sendEmail(realEmail, "Connexion Uber CM Pro", `<p>Votre code : <strong>${otp}</strong></p>`);

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
        const check = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2', [email, phone]);
        if (check.rows.length > 0) return res.status(400).json({ success: false, message: "Email ou téléphone déjà utilisé" });

        await db.query('INSERT INTO users (name, email, phone) VALUES ($1, $2, $3)', [name, email, phone]);
        res.status(201).json({ success: true, message: "Client créé" });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.requestOTP = async (req, res) => {
    const { phone } = req.body; 
    // ✅ CORRECTION ICI : Génère un code à 4 chiffres (ex: 4829)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
        const result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Aucun compte trouvé pour ce numéro" });
        }

        const targetEmail = result.rows[0].email;
        
        await db.query('UPDATE users SET otp_code = $1 WHERE phone = $2', [otp, phone]);

        await sendEmail(targetEmail, "Votre code de vérification Uber CM", `<p>Votre code est : <strong>${otp}</strong></p>`);

        res.status(200).json({ success: true, message: "OTP envoyé par email" });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.verifyOTP = async (req, res) => {
    let { phone, code } = req.body; 
    
    const cleanPhone = phone ? phone.trim() : "";
    const cleanCode = code ? code.toString().trim() : "";

    try {
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1', [cleanPhone]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        const storedOtp = userCheck.rows[0].otp_code;

        // ✅ Comparaison des codes
        if (storedOtp !== null && storedOtp.toString() === cleanCode) {
            // On supprime l'OTP utilisé, mais on ne touche pas à is_verified car la colonne n'existe pas
            await db.query('UPDATE users SET otp_code = NULL WHERE phone = $1', [cleanPhone]);
            
            return res.status(200).json({ 
                success: true, 
                message: "Compte vérifié",
                user: userCheck.rows[0]
            });
        }
        
        res.status(400).json({ success: false, message: "Code incorrect" });
    } catch (err) { 
        console.error("Erreur verifyOTP:", err);
        res.status(500).json({ success: false, message: "Erreur serveur" }); 
    }
};