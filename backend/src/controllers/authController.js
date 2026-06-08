const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { audit, ACTIONS } = require('../services/auditService');

const prisma = new PrismaClient();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    await audit({ id: user.id, email: user.email }, ACTIONS.USER_LOGIN, 'User', user.id, user.email);
    res.json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) { next(err); }
}

async function register(req, res, next) {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password and name are required.' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: role || 'VIEWER' },
    });
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) { next(err); }
}

async function me(req, res) {
  res.json({ user: req.user });
}

async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } });
    res.json(users);
  } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted.' });
  } catch (err) { next(err); }
}

module.exports = { login, register, me, listUsers, deleteUser };
