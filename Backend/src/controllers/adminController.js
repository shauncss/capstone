const adminModel = require('../models/adminModel');

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }
    const admin = await adminModel.validateCredentials({ username, password });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    return res.json({ ok: true, username: admin.username });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login
};
