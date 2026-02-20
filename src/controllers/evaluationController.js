const pool = require('../config/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// 평가하기
exports.evaluate = async (req, res) => {
  let conn;
  try {
    const { meetingId } = req.params;
    const { targetId, badge } = req.body;
    conn = await pool.getConnection();

    // 모임 완료 확인
    const [meeting] = await conn.query(
      'SELECT status FROM meetings WHERE id = ?',
      [meetingId]
    );
    if (!meeting || meeting.status !== 'completed') {
      return error(res, '완료된 모임만 평가할 수 있습니다.', 400);
    }

    // 본인 평가 불가
    if (req.user.id === parseInt(targetId)) {
      return error(res, '본인은 평가할 수 없습니다.', 400);
    }

    // 둘 다 모임 멤버인지 확인
    const members = await conn.query(
      'SELECT user_id FROM meeting_members WHERE meeting_id = ? AND user_id IN (?, ?)',
      [meetingId, req.user.id, targetId]
    );
    if (members.length < 2) {
      return error(res, '해당 모임의 참여자만 평가할 수 있습니다.', 403);
    }

    await conn.query(
      `INSERT INTO evaluations (meeting_id, evaluator_id, target_id, badge)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE badge = ?`,
      [meetingId, req.user.id, targetId, badge, badge]
    );

    return success(res, null, '평가가 등록되었습니다.');
  } catch (err) {
    logger.error('평가 오류:', { error: err.message, stack: err.stack });
    return error(res, '평가 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 평가 대상 목록 (모임원 리스트)
exports.getEvaluationTargets = async (req, res) => {
  let conn;
  try {
    const { meetingId } = req.params;
    conn = await pool.getConnection();

    const members = await conn.query(
      `SELECT u.id, u.nickname, u.profile_image,
              (SELECT badge FROM evaluations WHERE meeting_id = ? AND evaluator_id = ? AND target_id = u.id) as my_evaluation
       FROM meeting_members mm
       JOIN users u ON mm.user_id = u.id
       WHERE mm.meeting_id = ? AND mm.user_id != ?`,
      [meetingId, req.user.id, meetingId, req.user.id]
    );

    return success(res, members);
  } catch (err) {
    logger.error('평가 대상 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '평가 대상 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
