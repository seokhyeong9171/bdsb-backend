const pool = require('../config/db');
const { success, error } = require('../utils/response');

// 메뉴 조회 (가게별)
exports.getMenus = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const menus = await conn.query(
      'SELECT * FROM menus WHERE store_id = ? AND is_available = 1 ORDER BY name',
      [req.params.storeId]
    );
    return success(res, menus);
  } catch (err) {
    console.error('메뉴 조회 오류:', err);
    return error(res, '메뉴 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 메뉴 등록
exports.createMenu = async (req, res) => {
  let conn;
  try {
    const { name, price, description } = req.body;
    const storeId = req.params.storeId;
    conn = await pool.getConnection();

    // 가게 소유 확인
    const [store] = await conn.query('SELECT owner_id FROM stores WHERE id = ?', [storeId]);
    if (!store) return error(res, '가게를 찾을 수 없습니다.', 404);
    if (store.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    const result = await conn.query(
      'INSERT INTO menus (store_id, name, price, description) VALUES (?, ?, ?, ?)',
      [storeId, name, price, description || null]
    );

    return success(res, { id: Number(result.insertId) }, '메뉴가 등록되었습니다.', 201);
  } catch (err) {
    console.error('메뉴 등록 오류:', err);
    return error(res, '메뉴 등록 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 메뉴 수정
exports.updateMenu = async (req, res) => {
  let conn;
  try {
    const { name, price, description } = req.body;
    conn = await pool.getConnection();

    const [menu] = await conn.query(
      `SELECT m.*, s.owner_id FROM menus m JOIN stores s ON m.store_id = s.id WHERE m.id = ?`,
      [req.params.id]
    );
    if (!menu) return error(res, '메뉴를 찾을 수 없습니다.', 404);
    if (menu.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await conn.query(
      'UPDATE menus SET name = COALESCE(?, name), price = COALESCE(?, price), description = COALESCE(?, description) WHERE id = ?',
      [name, price, description, req.params.id]
    );

    return success(res, null, '메뉴가 수정되었습니다.');
  } catch (err) {
    console.error('메뉴 수정 오류:', err);
    return error(res, '메뉴 수정 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 메뉴 삭제
exports.deleteMenu = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [menu] = await conn.query(
      `SELECT m.*, s.owner_id FROM menus m JOIN stores s ON m.store_id = s.id WHERE m.id = ?`,
      [req.params.id]
    );
    if (!menu) return error(res, '메뉴를 찾을 수 없습니다.', 404);
    if (menu.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await conn.query('UPDATE menus SET is_available = 0 WHERE id = ?', [req.params.id]);
    return success(res, null, '메뉴가 삭제되었습니다.');
  } catch (err) {
    console.error('메뉴 삭제 오류:', err);
    return error(res, '메뉴 삭제 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
