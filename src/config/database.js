// ------------------------------------------
// PostgreSQL Database Connection (Neon + Railway)
// ------------------------------------------
const { Pool } = require("pg");
require("dotenv").config();

// ✅ Use DATABASE_URL directly from environment variables
// (Railway / Neon provides this securely)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is missing!");
  process.exit(1); // stop the server if no DB connection string
}

// ✅ Create a connection pool with SSL (required for Neon)
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// ✅ Verify the connection at startup
pool
  .connect()
  .then((client) => {
    console.log("🟢 Connected to PostgreSQL database successfully!");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Failed to connect to PostgreSQL:", err.message);
    process.exit(1); // crash if DB fails on startup
  });

// Export the pool for queries
module.exports = pool;
