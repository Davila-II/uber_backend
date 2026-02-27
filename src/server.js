const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const db = require('./config/db'); 
const authRoutes = require('./routes/authRoutes');

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json()); 

// ✅ RENDRE LE DOSSIER UPLOADS PUBLIC
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Routes ---
app.use('/api/auth', authRoutes);

// Route de test
app.get('/', (req, res) => {
  res.send('Le serveur Uber_CM fonctionne !');
});

// --- ✅ ROUTE POUR RÉCUPÉRER LE CHAUFFEUR ---
app.get('/chauffeurs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // On cherche le chauffeur dans PostgreSQL
    const result = await db.query('SELECT * FROM chauffeurs WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Chauffeur non trouvé" });
    }
    
    const chauffeur = result.rows[0];

    // On traduit les données de la DB (anglais) vers ce que Flutter attend (français)
    res.json({
      id: chauffeur.id,
      nom: chauffeur.name,
      marque: chauffeur.brand,
      modele: chauffeur.model,
      immatriculation: chauffeur.plate,
      photo_url: chauffeur.vehicle_img, // ou chauffeur.id_card_img si tu as une vraie photo
      note: 4.8 // Valeur par défaut pour l'instant
    });
    
  } catch (error) {
    console.error("Erreur serveur:", error.message);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
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
                    photo_url TEXT, -- ✅ AJOUTE CETTE LIGNE
                    otp_code VARCHAR(10),
                    role VARCHAR(50) DEFAULT 'user'
                );
            `);

        // Table Chauffeurs
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

        // ✅ CRÉATION D'UN CHAUFFEUR DE TEST SI LA TABLE EST VIDE
        const checkDriver = await db.query('SELECT * FROM chauffeurs WHERE id = 1');
        if (checkDriver.rows.length === 0) {
            await db.query(`
                INSERT INTO chauffeurs (id, name, brand, model, plate, vehicle_img, is_verified)
                VALUES (1, 'Arrel (Test Driver)', 'Toyota', 'Yaris', 'CE-123-AB', 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', TRUE)
            `);
            console.log("🚕 Chauffeur de test (ID 1) ajouté avec succès !");
        }
        
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