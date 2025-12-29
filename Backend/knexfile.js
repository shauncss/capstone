require('dotenv').config();

const { DATABASE_URL } = process.env;

/** @type {import('knex').Knex.Config} */
module.exports = {
  client: 'pg',
  connection: DATABASE_URL,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations'
  }
};
