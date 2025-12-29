exports.up = function (knex) {
  return knex.schema.createTable('sensor_logs', (table) => {
    table.increments('id').primary();
    table.string('pi_identifier').notNullable();
    table.string('status').defaultTo('online');
    table.decimal('temp', 4, 1).nullable();
    table.integer('spo2').nullable();
    table.integer('hr').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('sensor_logs');
};
