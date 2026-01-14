const path = require('path');
const dotenvPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: dotenvPath });

const adminModel = require('../src/models/adminModel');
const db = require('../src/db/knex');

function parseArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

async function main() {
  const username = parseArg('--username') || parseArg('-u');
  const password = parseArg('--password') || parseArg('-p');

  if (!username || !password) {
    console.error('Usage: node scripts/seedAdmin.js --username <username> --password <password>');
    process.exit(1);
  }

  try {
    const admin = await adminModel.upsertAdmin({ username, password });
    console.log(`Admin user ready: ${admin.username}`);
    process.exitCode = 0;
  } catch (err) {
    console.error('Failed to seed admin:', err.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();
