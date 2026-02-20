CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'client', -- Peut être 'client' ou 'driver'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);