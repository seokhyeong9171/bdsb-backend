const mariadb = require('mariadb');
const config = require('./index');

const pool = mariadb.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: 10,
  acquireTimeout: 30000,
  bigIntAsNumber: true,
});

pool.getConnection()
  .then(conn => {
    console.log('MariaDB 연결 성공');
    conn.release();
  })
  .catch(err => {
    console.error('MariaDB 연결 실패:', err.message);
  });

module.exports = pool;
