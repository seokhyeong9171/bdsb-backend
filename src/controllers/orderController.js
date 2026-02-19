const pool = require('../config/db');
const { success, error } = require('../utils/response');

// 사업자: 주문 목록 조회
exports.getStoreOrders = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { storeId } = req.params;

    const [store] = await conn.query('SELECT owner_id FROM stores WHERE id = ?', [storeId]);
    if (!store || store.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    const orders = await conn.query(
      `SELECT o.*, m.title as meeting_title, m.pickup_location, m.dining_type,
              (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as member_count
       FROM orders o
       JOIN meetings m ON o.meeting_id = m.id
       WHERE o.store_id = ?
       ORDER BY o.created_at DESC`,
      [storeId]
    );

    return success(res, orders);
  } catch (err) {
    console.error('주문 목록 조회 오류:', err);
    return error(res, '주문 목록 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 사업자: 주문 승인
exports.approveOrder = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { orderId } = req.params;

    const [order] = await conn.query(
      `SELECT o.*, s.owner_id FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.id = ?`,
      [orderId]
    );
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);
    if (order.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await conn.query('UPDATE orders SET status = "approved" WHERE id = ?', [orderId]);
    await conn.query('UPDATE meetings SET status = "cooking" WHERE id = ?', [order.meeting_id]);

    return success(res, null, '주문이 승인되었습니다.');
  } catch (err) {
    console.error('주문 승인 오류:', err);
    return error(res, '주문 승인 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 사업자: 주문 거절
exports.rejectOrder = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { orderId } = req.params;

    const [order] = await conn.query(
      `SELECT o.*, s.owner_id FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.id = ?`,
      [orderId]
    );
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);
    if (order.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await conn.query('UPDATE orders SET status = "rejected" WHERE id = ?', [orderId]);
    await conn.query('UPDATE meetings SET status = "cancelled" WHERE id = ?', [order.meeting_id]);

    // TODO: 결제 환불 처리

    return success(res, null, '주문이 거절되었습니다.');
  } catch (err) {
    console.error('주문 거절 오류:', err);
    return error(res, '주문 거절 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 사업자: 조리 완료 (→ 라이더 배차 요청)
exports.completeCoking = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { orderId } = req.params;

    const [order] = await conn.query(
      `SELECT o.*, s.owner_id FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.id = ?`,
      [orderId]
    );
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);
    if (order.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await conn.query('UPDATE orders SET status = "cooked" WHERE id = ?', [orderId]);
    await conn.query('UPDATE meetings SET status = "delivering" WHERE id = ?', [order.meeting_id]);

    // 모임원에게 알림
    const members = await conn.query(
      'SELECT user_id FROM meeting_members WHERE meeting_id = ?',
      [order.meeting_id]
    );
    for (const member of members) {
      await conn.query(
        `INSERT INTO notifications (user_id, type, title, content, reference_id, reference_type)
         VALUES (?, 'order', '조리 완료', '주문하신 음식 조리가 완료되었습니다. 곧 배달이 시작됩니다.', ?, 'order')`,
        [member.user_id, orderId]
      );
    }

    return success(res, null, '조리 완료 처리되었습니다. 라이더 배차를 요청합니다.');
  } catch (err) {
    console.error('조리 완료 처리 오류:', err);
    return error(res, '조리 완료 처리 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 사업자: 지연 사유 전달
exports.notifyDelay = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { orderId } = req.params;
    const { reason } = req.body;

    const [order] = await conn.query(
      `SELECT o.*, s.owner_id FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.id = ?`,
      [orderId]
    );
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);
    if (order.owner_id !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await conn.query('UPDATE orders SET delay_reason = ? WHERE id = ?', [reason, orderId]);

    const members = await conn.query(
      'SELECT user_id FROM meeting_members WHERE meeting_id = ?',
      [order.meeting_id]
    );
    for (const member of members) {
      await conn.query(
        `INSERT INTO notifications (user_id, type, title, content, reference_id, reference_type)
         VALUES (?, 'order', '배달 지연 안내', ?, ?, 'order')`,
        [member.user_id, reason, orderId]
      );
    }

    return success(res, null, '지연 사유가 전달되었습니다.');
  } catch (err) {
    console.error('지연 사유 전달 오류:', err);
    return error(res, '지연 사유 전달 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 라이더: 배차 대기 주문 목록
exports.getAvailableDeliveries = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const orders = await conn.query(
      `SELECT o.*, s.name as store_name, s.address as store_address,
              m.pickup_location, m.meeting_location
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       JOIN meetings m ON o.meeting_id = m.id
       WHERE o.status = 'cooked' AND o.rider_id IS NULL
       ORDER BY o.created_at ASC`
    );
    return success(res, orders);
  } catch (err) {
    console.error('배차 목록 조회 오류:', err);
    return error(res, '배차 목록 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 라이더: 배차 등록
exports.acceptDelivery = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { orderId } = req.params;

    const [order] = await conn.query('SELECT * FROM orders WHERE id = ? AND status = "cooked"', [orderId]);
    if (!order) return error(res, '배차 가능한 주문이 아닙니다.', 404);
    if (order.rider_id) return error(res, '이미 배차된 주문입니다.', 400);

    await conn.query('UPDATE orders SET rider_id = ?, status = "delivering" WHERE id = ?', [req.user.id, orderId]);

    return success(res, null, '배차가 등록되었습니다.');
  } catch (err) {
    console.error('배차 등록 오류:', err);
    return error(res, '배차 등록 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 라이더: 배달 완료
exports.completeDelivery = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { orderId } = req.params;

    const [order] = await conn.query('SELECT * FROM orders WHERE id = ? AND rider_id = ?', [orderId, req.user.id]);
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);

    await conn.query('UPDATE orders SET status = "delivered" WHERE id = ?', [orderId]);
    await conn.query('UPDATE meetings SET status = "delivered" WHERE id = ?', [order.meeting_id]);

    // 모임원에게 알림
    const members = await conn.query(
      'SELECT user_id FROM meeting_members WHERE meeting_id = ?',
      [order.meeting_id]
    );
    for (const member of members) {
      await conn.query(
        `INSERT INTO notifications (user_id, type, title, content, reference_id, reference_type)
         VALUES (?, 'delivery', '배달 완료', '주문하신 음식이 도착했습니다!', ?, 'order')`,
        [member.user_id, orderId]
      );
    }

    return success(res, null, '배달 완료 처리되었습니다.');
  } catch (err) {
    console.error('배달 완료 처리 오류:', err);
    return error(res, '배달 완료 처리 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
