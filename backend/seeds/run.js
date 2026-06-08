require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
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

async function seed() {
  const client = await pool.connect();
  try {
    const { rows: [admin_role] } = await client.query("SELECT id FROM roles WHERE name='admin'");
    if (!admin_role) {
      console.error('Roles not found – run migrations first');
      process.exit(1);
    }

    const password = process.env.ADMIN_PASSWORD || 'Admin@123!';
    const hash = await bcrypt.hash(password, 12);

    await client.query(`
      INSERT INTO users (username, email, password_hash, full_name, role_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO NOTHING
    `, [
      process.env.ADMIN_USERNAME || 'admin',
      process.env.ADMIN_EMAIL    || 'admin@terminal.com',
      hash,
      'System Administrator',
      admin_role.id,
    ]);

    console.log('Seed complete.');
    console.log(`Admin username: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`Admin password: ${password}`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
