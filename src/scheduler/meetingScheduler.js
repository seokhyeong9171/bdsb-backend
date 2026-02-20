const cron = require('node-cron');
const pool = require('../config/db');
const logger = require('../utils/logger');

// 매 분 실행: deadline이 지난 recruiting 모임을 closed로 변경
function startMeetingScheduler() {
  cron.schedule('* * * * *', async () => {
    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query(`
        UPDATE meetings SET status = 'closed'
        WHERE status = 'recruiting'
        AND deadline < NOW()
      `);

      if (result.affectedRows > 0) {
        logger.info(`모임 마감 자동 처리: ${result.affectedRows}건`);
      }
    } catch (err) {
      logger.error('모임 마감 스케줄러 오류:', { error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  logger.info('모임 마감 스케줄러가 시작되었습니다. (매 분 실행)');
}

module.exports = { startMeetingScheduler };
