import mysql from 'mysql2/promise';

let pool;

export function initMysqlPool(config) {
  const host = config.host || 'localhost';
  const port = config.port || 3306;
  const user = config.user || 'root';
  const password = config.password || '';
  const database = config.database || '';

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
  return pool;
}

export async function query(sql, params) {
  if (!pool) {
    throw new Error('MySQL pool not initialized. Call initMysqlPool first.');
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export default { initMysqlPool, query };
