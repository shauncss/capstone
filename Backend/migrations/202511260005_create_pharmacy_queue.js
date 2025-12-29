exports.up = function (knex) {
  return knex.schema.createTable('pharmacy_queue', (table) => {
    table.increments('id').primary();
    table
      .integer('queue_id')
      .references('id')
      .inTable('queue')
      .onDelete('CASCADE')
      .unique();
    table
      .integer('patient_id')
      .references('id')
      .inTable('patients')
      .onDelete('CASCADE');
    table.string('queue_number').notNullable();
    table.enu('status', ['waiting', 'ready', 'completed']).defaultTo('waiting');
    table.timestamp('called_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['status', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('pharmacy_queue');
};
