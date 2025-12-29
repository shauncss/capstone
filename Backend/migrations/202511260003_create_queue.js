exports.up = function (knex) {
  return knex.schema.createTable('queue', (table) => {
    table.increments('id').primary();
    table.integer('patient_id').references('id').inTable('patients').onDelete('CASCADE');
    table.string('queue_number').notNullable();
    table.enu('status', ['waiting', 'called', 'completed']).defaultTo('waiting');
    table.integer('assigned_room_id').references('id').inTable('rooms').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('queue');
};
