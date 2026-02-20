const cron = require('node-cron');
const { Op } = require('sequelize');
const { Meeting } = require('../models');
const logger = require('../utils/logger');

// 매 분 실행: deadline이 지난 recruiting 모임을 closed로 변경
function startMeetingScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const [affectedCount] = await Meeting.update(
        { status: 'closed' },
        { where: { status: 'recruiting', deadline: { [Op.lt]: new Date() } } }
      );

      if (affectedCount > 0) {
        logger.info(`모임 마감 자동 처리: ${affectedCount}건`);
      }
    } catch (err) {
      logger.error('모임 마감 스케줄러 오류:', { error: err.message });
    }
  });

  logger.info('모임 마감 스케줄러가 시작되었습니다. (매 분 실행)');
}

module.exports = { startMeetingScheduler };
