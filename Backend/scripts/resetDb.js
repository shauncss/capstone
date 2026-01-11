// Backend/scripts/resetDb.js
require('dotenv').config();
const db = require('../src/db/knex');

async function resetData() {
  try {
    console.log('🗑️  Clearing data...');

    // 1. Clear active patients from rooms
    // We try/catch this in case the column doesn't exist or is named differently
    try {
      await db('rooms').update({ current_patient_id: null });
    } catch (e) {
      console.log('   (Skipped room update)');
    }

    // 2. Delete all patients 
    // This triggers CASCADE deletion for 'queue' and 'pharmacy_queue'
    await db('patients').del();
    
    console.log('✅ All patient data deleted.');

    // 3. Reset ID counters (Postgres specific)
    await db.raw('ALTER SEQUENCE patients_id_seq RESTART WITH 1');
    await db.raw('ALTER SEQUENCE queue_id_seq RESTART WITH 1');
    await db.raw('ALTER SEQUENCE pharmacy_queue_id_seq RESTART WITH 1');
    console.log('✅ ID counters reset.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

resetData();