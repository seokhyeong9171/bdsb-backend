const pool = require('../config/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// 알림 목록 조회
exports.getNotifications = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await conn.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    const [unreadCount] = await conn.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    return success(res, { notifications, unreadCount: unreadCount?.count || 0 });
  } catch (err) {
    logger.error('알림 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '알림 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 알림 읽음 처리
exports.markAsRead = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return success(res, null, '알림을 읽었습니다.');
  } catch (err) {
    logger.error('알림 읽음 처리 오류:', { error: err.message, stack: err.stack });
    return error(res, '알림 읽음 처리 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 전체 읽음 처리
exports.markAllAsRead = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    return success(res, null, '모든 알림을 읽었습니다.');
  } catch (err) {
    logger.error('전체 읽음 처리 오류:', { error: err.message, stack: err.stack });
    return error(res, '전체 읽음 처리 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
