const pool = require('../config/db');
const { success, error } = require('../utils/response');

// 채팅방 조회 (모임별)
exports.getChatRoom = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { meetingId } = req.params;

    // 참여자 확인
    const [member] = await conn.query(
      'SELECT id FROM meeting_members WHERE meeting_id = ? AND user_id = ?',
      [meetingId, req.user.id]
    );
    if (!member) return error(res, '해당 모임의 참여자가 아닙니다.', 403);

    const [room] = await conn.query(
      'SELECT * FROM chat_rooms WHERE meeting_id = ?',
      [meetingId]
    );
    if (!room) return error(res, '채팅방을 찾을 수 없습니다.', 404);

    return success(res, room);
  } catch (err) {
    console.error('채팅방 조회 오류:', err);
    return error(res, '채팅방 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 채팅 메시지 조회
exports.getMessages = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const messages = await conn.query(
      `SELECT cm.*, u.nickname, u.profile_image
       FROM chat_messages cm
       JOIN users u ON cm.sender_id = u.id
       WHERE cm.room_id = ?
       ORDER BY cm.created_at DESC
       LIMIT ? OFFSET ?`,
      [roomId, parseInt(limit), offset]
    );

    return success(res, messages);
  } catch (err) {
    console.error('메시지 조회 오류:', err);
    return error(res, '메시지 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 채팅 메시지 전송 (REST fallback - Socket.IO도 지원)
exports.sendMessage = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { roomId } = req.params;
    const { message } = req.body;

    const result = await conn.query(
      'INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)',
      [roomId, req.user.id, message]
    );

    return success(res, { id: Number(result.insertId) }, '메시지가 전송되었습니다.', 201);
  } catch (err) {
    console.error('메시지 전송 오류:', err);
    return error(res, '메시지 전송 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
