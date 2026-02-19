const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { success, error } = require('../utils/response');

// 내 정보 조회
exports.getProfile = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [user] = await conn.query(
      `SELECT id, email, name, nickname, phone, role, university, campus, department,
              address, profile_image, points, is_verified, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!user) return error(res, '사용자를 찾을 수 없습니다.', 404);

    // 완료 모임 수
    const [meetingCount] = await conn.query(
      `SELECT COUNT(*) as count FROM meeting_members mm
       JOIN meetings m ON mm.meeting_id = m.id
       WHERE mm.user_id = ? AND m.status = 'completed'`,
      [req.user.id]
    );

    // 평가 뱃지 집계
    const badges = await conn.query(
      `SELECT badge, COUNT(*) as count FROM evaluations WHERE target_id = ? GROUP BY badge`,
      [req.user.id]
    );

    return success(res, {
      ...user,
      completed_meetings: meetingCount?.count || 0,
      badges: badges || [],
    });
  } catch (err) {
    console.error('프로필 조회 오류:', err);
    return error(res, '프로필 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 다른 유저 정보 조회
exports.getUserInfo = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [user] = await conn.query(
      `SELECT id, nickname, department, profile_image FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (!user) return error(res, '사용자를 찾을 수 없습니다.', 404);

    const [meetingCount] = await conn.query(
      `SELECT COUNT(*) as count FROM meeting_members mm
       JOIN meetings m ON mm.meeting_id = m.id
       WHERE mm.user_id = ? AND m.status = 'completed'`,
      [req.params.id]
    );

    const badges = await conn.query(
      `SELECT badge, COUNT(*) as count FROM evaluations WHERE target_id = ? GROUP BY badge`,
      [req.params.id]
    );

    return success(res, {
      ...user,
      completed_meetings: meetingCount?.count || 0,
      badges: badges || [],
    });
  } catch (err) {
    console.error('유저 정보 조회 오류:', err);
    return error(res, '유저 정보 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 내 정보 수정
exports.updateProfile = async (req, res) => {
  let conn;
  try {
    const { currentPassword, nickname, profileImage } = req.body;
    conn = await pool.getConnection();

    const [user] = await conn.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return error(res, '비밀번호가 올바르지 않습니다.', 401);

    if (nickname) {
      const [dup] = await conn.query('SELECT id FROM users WHERE nickname = ? AND id != ?', [nickname, req.user.id]);
      if (dup) return error(res, '이미 사용 중인 닉네임입니다.', 409);
    }

    await conn.query(
      `UPDATE users SET nickname = COALESCE(?, nickname), profile_image = COALESCE(?, profile_image)
       WHERE id = ?`,
      [nickname || null, profileImage || null, req.user.id]
    );

    return success(res, null, '프로필이 수정되었습니다.');
  } catch (err) {
    console.error('프로필 수정 오류:', err);
    return error(res, '프로필 수정 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 회원 탈퇴
exports.deleteAccount = async (req, res) => {
  let conn;
  try {
    const { password } = req.body;
    conn = await pool.getConnection();

    const [user] = await conn.query('SELECT password, points FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return error(res, '비밀번호가 올바르지 않습니다.', 401);

    // 진행 중인 모임 확인
    const [activeMeeting] = await conn.query(
      `SELECT COUNT(*) as count FROM meeting_members mm
       JOIN meetings m ON mm.meeting_id = m.id
       WHERE mm.user_id = ? AND m.status NOT IN ('completed', 'cancelled')`,
      [req.user.id]
    );
    if (activeMeeting?.count > 0) {
      return error(res, '진행 중인 모임이 있어 탈퇴할 수 없습니다.', 400);
    }

    // 잔여 포인트 확인
    if (user.points > 0) {
      return error(res, '잔여 포인트가 있어 탈퇴할 수 없습니다. 포인트를 먼저 소진하세요.', 400);
    }

    await conn.query('DELETE FROM users WHERE id = ?', [req.user.id]);
    return success(res, null, '회원 탈퇴가 완료되었습니다.');
  } catch (err) {
    console.error('회원 탈퇴 오류:', err);
    return error(res, '회원 탈퇴 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 주문 내역 조회
exports.getOrderHistory = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const orders = await conn.query(
      `SELECT o.id, o.status, o.total_amount, o.delivery_fee, o.created_at,
              s.name as store_name, s.thumbnail as store_thumbnail,
              m.title as meeting_title, m.dining_type
       FROM payments p
       JOIN meetings m ON p.meeting_id = m.id
       JOIN orders o ON o.meeting_id = m.id
       JOIN stores s ON o.store_id = s.id
       WHERE p.user_id = ?
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    return success(res, orders);
  } catch (err) {
    console.error('주문 내역 조회 오류:', err);
    return error(res, '주문 내역 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
