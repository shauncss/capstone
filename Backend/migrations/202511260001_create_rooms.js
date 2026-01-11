exports.up = function (knex) {
  return knex.schema.createTable('rooms', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.boolean('is_available').defaultTo(true);
    table.integer('current_patient_id').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  })
  .then(function () {
    // fix to 2 rooms
    return knex('rooms').insert([
      { id: 1, name: 'Consultation Room 1', is_available: true },
      { id: 2, name: 'Consultation Room 2', is_available: true }
    ]);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('rooms');
};
