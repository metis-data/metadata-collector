const { Pool, Client } = require('pg');

const credentials = {
  user: 'postgres',
  host: 'database-2.cofhrj7zmyn4.eu-central-1.rds.amazonaws.com',
  database: 'airbases',
  password: 'Trustno1',
  port: 5432,
};

// Connect with a connection pool.

const poolDemo = async () => {
  const pool = new Pool(credentials);
  const now = await pool.query('EXPLAIN ANALYZE select * from postgres_air.phone limit 25');
  await pool.end();

  return now;
}

// Connect with a client.

const clientDemo = async () => {
  const client = new Client(credentials);
  await client.connect();
  const now = await client.query('EXPLAIN (ANALYZE, FORMAT JSON) select * from postgres_air.phone limit 25');
  await client.end();

  return now;
}
