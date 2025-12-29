const db = require('../db/knex');
const { hashPassword, verifyPassword } = require('../utils/password');

async function findByUsername(username) {
  return db('admins').where({ username }).first();
}

async function createAdmin({ username, password }) {
  const password_hash = hashPassword(password);
  const [record] = await db('admins').insert({ username, password_hash }).returning('*');
  return record;
}

async function upsertAdmin({ username, password }) {
  const existing = await findByUsername(username);
  const password_hash = hashPassword(password);
  if (existing) {
    const [record] = await db('admins')
      .where({ id: existing.id })
      .update({ password_hash, updated_at: db.fn.now() })
      .returning('*');
    return record;
  }
  return createAdmin({ username, password });
}

async function validateCredentials({ username, password }) {
  const admin = await findByUsername(username);
  if (!admin) return null;
  const valid = verifyPassword(password, admin.password_hash);
  return valid ? admin : null;
}

module.exports = {
  findByUsername,
  createAdmin,
  upsertAdmin,
  validateCredentials
};
