const axios = require('axios');
const db = require('../config/db'); 

const BREVO_API_KEY = process.env.BREVO_API_KEY;

exports.requestOTP = async (req, res) => {
    const { phone } = req.body; // Seul le téléphone est nécessaire pour la connexion
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        // 1. Recherche de l'utilisateur
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);

        if (userCheck.rows.length === 0) {
            console.log(`⚠️ Tentative de connexion - Numéro non trouvé : ${phone}`);
            return res.status(404).json({ 
                success: false, 
                message: "Ce numéro n'est pas enregistré. Veuillez créer un compte." 
            });
        }

        const user = userCheck.rows[0];
        const targetEmail = user.email;
        const targetName = user.name;

        // 2. Mise à jour de l'OTP en base
        await db.query('UPDATE users SET otp_code = $1 WHERE phone = $2', [otpCode, phone]);
        console.log(`✅ OTP généré pour ${targetName} (${phone})`);

        // 3. Envoi de l'email
        try {
            await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Uber CM", email: "daviladutau@gmail.com" },
                to: [{ email: targetEmail, name: targetName }],
                subject: "Code de connexion Uber CM",
                htmlContent: `<h4>Bonjour ${targetName},</h4><p>Votre code de connexion est : <strong>${otpCode}</strong></p>`
            }, {
                headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
            });
            console.log(`📧 Email envoyé à ${targetEmail}`);
        } catch (emailErr) {
            console.error("⚠️ Erreur Brevo:", emailErr.response ? emailErr.response.data : emailErr.message);
            // On peut quand même répondre 200 si l'OTP est en base, mais c'est risqué si le mail ne part pas
        }

        res.status(200).json({ success: true, message: "Code envoyé par email" });

    } catch (err) {
        console.error("❌ Erreur Serveur:", err.message);
        res.status(500).json({ success: false, message: "Erreur technique" });
    }
};

exports.verifyOTP = async (req, res) => {
    const { phone, code } = req.body;
    try {
        const result = await db.query(
            'SELECT * FROM users WHERE phone = $1 AND otp_code = $2',
            [phone, code]
        );

        if (result.rows.length > 0) {
            await db.query('UPDATE users SET otp_code = NULL WHERE phone = $1', [phone]);
            console.log(`✅ Code validé pour ${phone}`);
            return res.status(200).json({ success: true, message: "Vérification réussie" });
        } else {
            return res.status(400).json({ success: false, message: "Code incorrect" });
        }
    } catch (err) {
        console.error("❌ Erreur verifyOTP:", err);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};
