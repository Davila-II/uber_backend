const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db'); 
const authRoutes = require('./routes/authRoutes');

const app = express(); // Initialisation de l'application

// Middlewares
app.use(cors());
app.use(express.json()); 

// Routes
app.use('/api/auth', authRoutes);

// Route de test
app.get('/', (req, res) => {
  res.send('Le serveur Uber_CM fonctionne !');
});

// Configuration du Port pour Railway
const PORT = process.env.PORT || 5000;

// Script de réparation automatique de la base de données
const initDB = async () => {
    try {
        console.log("⏳ Vérification de la structure de la base de données...");
        // Cette commande transforme la colonne phone en texte si elle était en nombre
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) UNIQUE,
                name VARCHAR(255),
                email VARCHAR(255),
                otp_code VARCHAR(10),
                role VARCHAR(50) DEFAULT 'user'
            );
            ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(20);
        `);
        console.log("✅ Base de données synchronisée (Types VARCHAR vérifiés)");
    } catch (err) {
        console.error("❌ Erreur lors de l'initDB:", err.message);
    }
};

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', async () => {
    await initDB(); // On répare la DB juste après le lancement
    console.log(`✅ Serveur Uber_CM lancé avec succès sur le port ${PORT}`);
});
