const { Pool } = require('pg');

// Railway (and most cloud providers) supply a single DATABASE_URL.
// Fall back to individual vars for local/Docker Compose dev.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'port_terminal_erp',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool({ ...poolConfig, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.debug('DB query:', { text: text.substring(0, 80), duration, rows: res.rowCount });
  }
  return res;
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
