require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', methods: ['GET', 'POST'] },
});

// Trust proxy (needed when behind nginx in Docker)
app.set('trust proxy', 1);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
}));
app.use('/api/', rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests.' },
}));

// ─── Share io with controllers ────────────────────────────────────────────────
app.set('io', io);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./src/routes/auth'));
app.use('/api/users',       require('./src/routes/users'));
app.use('/api/containers',  require('./src/routes/containers'));
app.use('/api/trucks',      require('./src/routes/trucks'));
app.use('/api/dashboard',   require('./src/routes/dashboard'));
app.use('/api/reports',     require('./src/routes/reports'));
app.use('/api/leave',       require('./src/routes/leave'));
app.use('/api/permissions', require('./src/routes/permissions'));
app.use('/api/parts',       require('./src/routes/parts'));
app.use('/api/stock',       require('./src/routes/stock'));
app.use('/api/compliance',  require('./src/routes/compliance'));
app.use('/api/grievances',  require('./src/routes/grievances'));
app.use('/api/feedback',    require('./src/routes/feedback'));
app.use('/api/gangs',       require('./src/routes/gangs'));
app.use('/api/training',    require('./src/routes/training'));
app.use('/api/fleet',       require('./src/routes/fleet'));
app.use('/api/statements',  require('./src/routes/statements'));
app.use('/api/integrity',   require('./src/routes/integrity'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.join('operations');
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error.'
    : err.message;
  res.status(status).json({ error: message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Port Terminal ERP API`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
  require('./src/services/scheduler').startScheduler();
  require('./src/controllers/permissionController').ensureRbacSchema()
    .then(() => console.log('  RBAC schema ready'))
    .catch(e => console.error('  RBAC schema error:', e.message));
  require('./src/controllers/leaveController').ensureSchema()
    .then(() => console.log('  LMS schema ready'))
    .catch(e => console.error('  LMS schema error:', e.message));
});

module.exports = { app, server };
