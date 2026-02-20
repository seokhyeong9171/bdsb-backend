const mysql = require('mysql2/promise');
const config = require('./index');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: 10,
  waitForConnections: true,
  ...(config.db.ssl && {
    ssl: { rejectUnauthorized: false },
  }),
});

pool.getConnection()
  .then(conn => {
    logger.info('MySQL(RDS) 연결 성공');
    conn.release();
  })
  .catch(err => {
    logger.error('MySQL(RDS) 연결 실패:', { error: err.message });
  });

module.exports = pool;
