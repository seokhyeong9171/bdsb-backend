const mariadb = require('mariadb');
const config = require('./index');
const logger = require('../utils/logger');

const pool = mariadb.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: 10,
  acquireTimeout: 30000,
  bigIntAsNumber: true,
  allowPublicKeyRetrieval: true,
  ...(config.db.ssl && {
    ssl: { rejectUnauthorized: false },
  }),
});

pool.getConnection()
  .then(conn => {
    logger.info('MariaDB(RDS) 연결 성공');
    conn.release();
  })
  .catch(err => {
    logger.error('MariaDB(RDS) 연결 실패:', { error: err.message });
  });

module.exports = pool;
