exports.up = function(knex) {
  return knex.schema.createTable('appointments', function(table) {
    table.increments('id').primary();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.string('phone');
    table.datetime('appointment_time').notNullable();
    table.string('status').defaultTo('booked'); // booked, checked_in, cancelled
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('appointments');
};