// Backend/scripts/resetDb.js
require('dotenv').config();
const db = require('../src/db/knex');

async function resetData() {
  try {
    console.log('🗑️  Clearing data...');

    // 1. Clear child tables first (to prevent Foreign Key errors)
    // These tables reference 'patients', so they must be emptied before 'patients'
    await db('payment_queue').del();
    await db('pharmacy_queue').del();
    await db('queue').del();
    await db('sensor_logs').del(); 
    
    // 2. Clear independent tables
    await db('appointments').del();

    // 3. Unlink active patients from rooms
    try {
      await db('rooms').update({ current_patient_id: null });
    } catch (e) {
      console.log('   (Skipped room update)');
    }

    // 4. Delete all patients 
    await db('patients').del();
    
    console.log('✅ All table data deleted.');

    // 5. Reset ID counters (Postgres specific)
    // We use a helper function to avoid crashing if a sequence doesn't exist
    const resetSeq = async (seqName) => {
      try {
        await db.raw(`ALTER SEQUENCE ${seqName} RESTART WITH 1`);
      } catch (e) {
        // Ignore error if sequence doesn't exist (e.g. if table dropped)
      }
    };

    await resetSeq('patients_id_seq');
    await resetSeq('queue_id_seq');
    await resetSeq('pharmacy_queue_id_seq');
    await resetSeq('payment_queue_id_seq');
    await resetSeq('appointments_id_seq');
    await resetSeq('sensor_logs_id_seq');

    console.log('✅ ID counters reset.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

resetData();