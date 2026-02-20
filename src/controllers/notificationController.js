const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { Notification } = require('../models');

// 알림 목록 조회
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    const unreadCount = await Notification.count({
      where: { userId: req.user.id, isRead: false },
    });

    return success(res, { notifications, unreadCount });
  } catch (err) {
    logger.error('알림 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '알림 조회 중 오류가 발생했습니다.');
  }
};

// 알림 읽음 처리
exports.markAsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { id: req.params.id, userId: req.user.id } }
    );
    return success(res, null, '알림을 읽었습니다.');
  } catch (err) {
    logger.error('알림 읽음 처리 오류:', { error: err.message, stack: err.stack });
    return error(res, '알림 읽음 처리 중 오류가 발생했습니다.');
  }
};

// 전체 읽음 처리
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id, isRead: false } }
    );
    return success(res, null, '모든 알림을 읽었습니다.');
  } catch (err) {
    logger.error('전체 읽음 처리 오류:', { error: err.message, stack: err.stack });
    return error(res, '전체 읽음 처리 중 오류가 발생했습니다.');
  }
};
