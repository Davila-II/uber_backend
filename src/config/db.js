const { Pool } = require('pg');

// Railway fournit automatiquement DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Indispensable pour les connexions sécurisées Railway
  }
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Erreur de connexion à PostgreSQL :', err.stack);
  }
  console.log('✅ Connecté avec succès à la base de données PostgreSQL de Railway !');
  release();
});

module.exports = pool;
