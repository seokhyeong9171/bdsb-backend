const pool = require('../config/db');
const { success, error } = require('../utils/response');

// 문의 등록
exports.createInquiry = async (req, res) => {
  let conn;
  try {
    const { title, content } = req.body;
    conn = await pool.getConnection();

    const result = await conn.query(
      'INSERT INTO inquiries (user_id, title, content) VALUES (?, ?, ?)',
      [req.user.id, title, content]
    );

    return success(res, { id: Number(result.insertId) }, '문의가 등록되었습니다.', 201);
  } catch (err) {
    console.error('문의 등록 오류:', err);
    return error(res, '문의 등록 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 내 문의 목록 조회
exports.getMyInquiries = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const inquiries = await conn.query(
      'SELECT id, title, status, created_at, answered_at FROM inquiries WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    return success(res, inquiries);
  } catch (err) {
    console.error('문의 목록 조회 오류:', err);
    return error(res, '문의 목록 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 문의 상세 조회
exports.getInquiry = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [inquiry] = await conn.query(
      'SELECT * FROM inquiries WHERE id = ?',
      [req.params.id]
    );
    if (!inquiry) return error(res, '문의를 찾을 수 없습니다.', 404);

    // 본인 또는 관리자만 조회 가능
    if (inquiry.user_id !== req.user.id && req.user.role !== 'admin') {
      return error(res, '권한이 없습니다.', 403);
    }

    return success(res, inquiry);
  } catch (err) {
    console.error('문의 상세 조회 오류:', err);
    return error(res, '문의 상세 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
