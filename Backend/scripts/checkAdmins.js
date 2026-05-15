const db = require('../src/db/knex');

async function checkAdmins() {
  try {
    // Fetch all usernames from the admins table
    const admins = await db('admins').select('username', 'created_at');

    console.log("--- Existing Admin Accounts ---");
    if (admins.length === 0) {
        console.log("No admins found in this database!");
    } else {
        console.table(admins);
    }
  } catch (err) {
    console.error("Error fetching admins:", err.message);
  } finally {
    await db.destroy(); // Close the connection
  }
}

checkAdmins();