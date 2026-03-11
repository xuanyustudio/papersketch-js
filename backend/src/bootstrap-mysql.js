import { initMysqlPool } from './db/mysqlAdapter.js';

export function bootstrapMysql() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
  };

  const pool = initMysqlPool(config);
  console.log('[MySQL] pool initialized', config.database ? `db=${config.database}` : '');
  return pool;
}
