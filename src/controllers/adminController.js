const pool = require('../config/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// 회원 목록 조회
exports.getUsers = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT id, email, name, nickname, phone, role, department, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR nickname LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const users = await conn.query(query, params);
    return success(res, users);
  } catch (err) {
    logger.error('회원 목록 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '회원 목록 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 회원 정보 수정 (관리자)
exports.updateUser = async (req, res) => {
  let conn;
  try {
    const { department, isActive } = req.body;
    conn = await pool.getConnection();

    await conn.query(
      `UPDATE users SET department = COALESCE(?, department), is_active = COALESCE(?, is_active) WHERE id = ?`,
      [department, isActive !== undefined ? (isActive ? 1 : 0) : null, req.params.id]
    );

    return success(res, null, '회원 정보가 수정되었습니다.');
  } catch (err) {
    logger.error('회원 수정 오류:', { error: err.message, stack: err.stack });
    return error(res, '회원 수정 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 계정 정지/해제
exports.toggleSuspend = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [user] = await conn.query('SELECT is_active FROM users WHERE id = ?', [req.params.id]);
    if (!user) return error(res, '사용자를 찾을 수 없습니다.', 404);

    const newStatus = user.is_active ? 0 : 1;
    await conn.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);

    return success(res, { isActive: !!newStatus }, newStatus ? '계정이 활성화되었습니다.' : '계정이 정지되었습니다.');
  } catch (err) {
    logger.error('계정 정지 처리 오류:', { error: err.message, stack: err.stack });
    return error(res, '계정 정지 처리 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 문의 목록 조회 (관리자)
exports.getInquiries = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT i.*, u.name as user_name, u.nickname as user_nickname
      FROM inquiries i
      JOIN users u ON i.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const inquiries = await conn.query(query, params);
    return success(res, inquiries);
  } catch (err) {
    logger.error('문의 목록 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '문의 목록 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 문의 답변 (관리자)
exports.answerInquiry = async (req, res) => {
  let conn;
  try {
    const { answer } = req.body;
    conn = await pool.getConnection();

    const [inquiry] = await conn.query('SELECT * FROM inquiries WHERE id = ?', [req.params.id]);
    if (!inquiry) return error(res, '문의를 찾을 수 없습니다.', 404);
    if (inquiry.status === 'answered') return error(res, '이미 답변된 문의입니다.', 400);

    await conn.query(
      `UPDATE inquiries SET answer = ?, status = 'answered', answered_at = NOW(), answered_by = ? WHERE id = ?`,
      [answer, req.user.id, req.params.id]
    );

    // 문의자에게 알림
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, content, reference_id, reference_type)
       VALUES (?, 'system', '문의 답변 완료', '문의하신 내용에 답변이 등록되었습니다.', ?, 'inquiry')`,
      [inquiry.user_id, req.params.id]
    );

    return success(res, null, '답변이 등록되었습니다.');
  } catch (err) {
    logger.error('답변 등록 오류:', { error: err.message, stack: err.stack });
    return error(res, '답변 등록 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
