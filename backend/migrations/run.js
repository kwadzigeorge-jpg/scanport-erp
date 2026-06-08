require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'port_terminal_erp',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD,
      }
);

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id       SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        ran_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: ran } = await client.query('SELECT filename FROM migrations ORDER BY filename');
    const ranFiles = new Set(ran.map(r => r.filename));

    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (ranFiles.has(file)) {
        console.log(`  [skip] ${file}`);
        continue;
      }
      console.log(`  [run]  ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  [done] ${file}`);
    }
    console.log('\nMigrations complete.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
