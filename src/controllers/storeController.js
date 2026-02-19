const pool = require('../config/db');
const { success, error } = require('../utils/response');

// 가게 등록
exports.createStore = async (req, res) => {
  let conn;
  try {
    const { name, description, category, phone, address, openTime, closeTime, closedDays, deliveryFee, minOrderAmount } = req.body;
    conn = await pool.getConnection();

    const result = await conn.query(
      `INSERT INTO stores (owner_id, name, description, category, phone, address, open_time, close_time, closed_days, delivery_fee, min_order_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, description || null, category || 'etc', phone || null, address, openTime || null, closeTime || null, closedDays || null, deliveryFee || 0, minOrderAmount || 0]
    );

    return success(res, { id: Number(result.insertId) }, '가게가 등록되었습니다.', 201);
  } catch (err) {
    console.error('가게 등록 오류:', err);
    return error(res, '가게 등록 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 내 가게 목록 조회
exports.getMyStores = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const stores = await conn.query(
      'SELECT * FROM stores WHERE owner_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [req.user.id]
    );
    return success(res, stores);
  } catch (err) {
    console.error('가게 목록 조회 오류:', err);
    return error(res, '가게 목록 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 가게 상세 조회
exports.getStore = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [store] = await conn.query('SELECT * FROM stores WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!store) return error(res, '가게를 찾을 수 없습니다.', 404);

    const menus = await conn.query(
      'SELECT * FROM menus WHERE store_id = ? AND is_available = 1 ORDER BY name',
      [req.params.id]
    );

    const images = await conn.query(
      'SELECT * FROM images WHERE target_type = "store" AND target_id = ?',
      [req.params.id]
    );

    return success(res, { ...store, menus, images });
  } catch (err) {
    console.error('가게 상세 조회 오류:', err);
    return error(res, '가게 상세 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 가게 목록 조회 (유저용 - 카테고리/검색)
exports.listStores = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { category, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT * FROM stores WHERE is_active = 1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const stores = await conn.query(query, params);
    return success(res, stores);
  } catch (err) {
    console.error('가게 목록 조회 오류:', err);
    return error(res, '가게 목록 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 가게 수정
exports.updateStore = async (req, res) => {
  let conn;
  try {
    const { name, description, category, phone, address, openTime, closeTime, closedDays, deliveryFee, minOrderAmount } = req.body;
    conn = await pool.getConnection();

    const [store] = await conn.query('SELECT owner_id FROM stores WHERE id = ?', [req.params.id]);
    if (!store) return error(res, '가게를 찾을 수 없습니다.', 404);
    if (store.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await conn.query(
      `UPDATE stores SET name = COALESCE(?, name), description = COALESCE(?, description),
       category = COALESCE(?, category), phone = COALESCE(?, phone), address = COALESCE(?, address),
       open_time = COALESCE(?, open_time), close_time = COALESCE(?, close_time),
       closed_days = COALESCE(?, closed_days), delivery_fee = COALESCE(?, delivery_fee),
       min_order_amount = COALESCE(?, min_order_amount)
       WHERE id = ?`,
      [name, description, category, phone, address, openTime, closeTime, closedDays, deliveryFee, minOrderAmount, req.params.id]
    );

    return success(res, null, '가게 정보가 수정되었습니다.');
  } catch (err) {
    console.error('가게 수정 오류:', err);
    return error(res, '가게 수정 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 가게 삭제
exports.deleteStore = async (req, res) => {
  let conn;
  try {
    const { password } = req.body;
    conn = await pool.getConnection();

    const [store] = await conn.query('SELECT owner_id FROM stores WHERE id = ?', [req.params.id]);
    if (!store) return error(res, '가게를 찾을 수 없습니다.', 404);
    if (store.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    // 비밀번호 확인
    const bcrypt = require('bcryptjs');
    const [user] = await conn.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return error(res, '비밀번호가 올바르지 않습니다.', 401);

    // 진행 중인 주문 확인
    const [activeOrder] = await conn.query(
      `SELECT COUNT(*) as count FROM orders WHERE store_id = ? AND status NOT IN ('completed', 'cancelled')`,
      [req.params.id]
    );
    if (activeOrder?.count > 0) {
      return error(res, '진행 중인 주문이 있어 삭제할 수 없습니다.', 400);
    }

    await conn.query('UPDATE stores SET is_active = 0 WHERE id = ?', [req.params.id]);
    return success(res, null, '가게가 삭제되었습니다.');
  } catch (err) {
    console.error('가게 삭제 오류:', err);
    return error(res, '가게 삭제 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
