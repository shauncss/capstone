exports.up = function (knex) {
  return knex.schema.createTable('patients', (table) => {
    table.increments('id').primary();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.date('date_of_birth');
    table.string('phone');
    table.text('symptoms');
    table.string('queue_number').notNullable().unique();
    table.decimal('temp', 4, 1).nullable();
    table.integer('spo2').nullable();
    table.integer('hr').nullable();
    table.integer('eta_minutes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('patients');
};
