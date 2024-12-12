const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'relative_positional_accuracy',
  password: '6398',
  port: 5432,
});

module.exports = pool;
