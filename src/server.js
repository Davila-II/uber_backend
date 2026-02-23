const express = require('express');
const cors = require('cors');
const path = require('path'); // Nécessaire pour gérer les chemins de fichiers
require('dotenv').config();
const db = require('./config/db'); 
const authRoutes = require('./routes/authRoutes');

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json()); 

// ✅ RENDRE LE DOSSIER UPLOADS PUBLIC
// Cela permet de voir les images via : https://ton-url.railway.app/uploads/nom-image.jpg
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Routes ---
app.use('/api/auth', authRoutes);

// Route de test
app.get('/', (req, res) => {
  res.send('Le serveur Uber_CM fonctionne !');
});

const PORT = process.env.PORT || 5000;

// --- Script de réparation / Création automatique des tables ---
const initDB = async () => {
    try {
        console.log("⏳ Synchronisation de la base de données...");
        
        // Table Users
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) UNIQUE,
                name VARCHAR(255),
                email VARCHAR(255),
                otp_code VARCHAR(10),
                role VARCHAR(50) DEFAULT 'user'
            );
        `);

        // ✅ RE-CRÉATION DE LA TABLE CHAUFFEURS (Après ton DROP)
        await db.query(`
            CREATE TABLE IF NOT EXISTS chauffeurs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE,
                phone VARCHAR(20),
                city VARCHAR(100),
                referral_code VARCHAR(50),
                otp_code VARCHAR(10),
                is_verified BOOLEAN DEFAULT FALSE,
                brand VARCHAR(100),
                model VARCHAR(100),
                year VARCHAR(10),
                color VARCHAR(50),
                plate VARCHAR(50),
                license_img TEXT,
                insurance_img TEXT,
                id_card_img TEXT,
                vehicle_img TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log("✅ Base de données synchronisée (Tables vérifiées)");
    } catch (err) {
        console.error("❌ Erreur lors de l'initDB:", err.message);
    }
};

// --- Démarrage ---
app.listen(PORT, '0.0.0.0', async () => {
    await initDB();
    console.log(`✅ Serveur Uber_CM lancé sur le port ${PORT}`);
});