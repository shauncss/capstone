exports.up = function(knex) {
  return knex.schema.createTable('appointments', function(table) {
    table.increments('id').primary();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.date('date_of_birth');
    table.string('phone');
    table.datetime('appointment_time').notNullable();

    table.text('symptoms');
    table.string('checkin_temp');
    table.string('checkin_spo2');
    table.string('checkin_hr');

    table.string('status').defaultTo('booked');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('appointments');
};