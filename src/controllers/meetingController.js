const pool = require('../config/db');
const { success, error } = require('../utils/response');

// 모임 생성
exports.createMeeting = async (req, res) => {
  let conn;
  try {
    const {
      storeId, title, diningType, orderType, pickupLocation, meetingLocation,
      minMembers, maxMembers, deliveryFee, allowEarlyOrder, deadline, description, campus
    } = req.body;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 추가된 변환 코드
    const deadlineMysql = new Date(deadline)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
// "2026-02-19T02:25:00.000Z" → "2026-02-19 02:25:00"

    const result = await conn.query(
      `INSERT INTO meetings (leader_id, store_id, title, dining_type, order_type,
       pickup_location, meeting_location, min_members, max_members, delivery_fee,
       allow_early_order, deadline, description, campus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, storeId, title, diningType || 'individual', orderType || 'instant',
       pickupLocation, meetingLocation || null, minMembers || 2, maxMembers || 4,
       deliveryFee || 0, allowEarlyOrder ? 1 : 0, deadline, description || null, campus || null]
    );

    const meetingId = Number(result.insertId);

    // 모임장을 멤버로 추가
    await conn.query(
      'INSERT INTO meeting_members (meeting_id, user_id, is_leader) VALUES (?, ?, 1)',
      [meetingId, req.user.id]
    );

    // 채팅방 자동 생성
    await conn.query(
      'INSERT INTO chat_rooms (meeting_id) VALUES (?)',
      [meetingId]
    );

    await conn.commit();
    return success(res, { id: meetingId }, '모임이 생성되었습니다.', 201);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('모임 생성 오류:', err);
    return error(res, '모임 생성 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 모임 리스트 조회 (모집 중인 것)
exports.listMeetings = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { campus, category, sort = 'latest', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT m.*, s.name as store_name, s.category as store_category, s.thumbnail as store_thumbnail,
        (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members,
        u.nickname as leader_nickname
      FROM meetings m
      JOIN stores s ON m.store_id = s.id
      JOIN users u ON m.leader_id = u.id
      WHERE m.status = 'recruiting' AND m.deadline > NOW()
    `;
    const params = [];

    if (campus) {
      query += ' AND m.campus = ?';
      params.push(campus);
    }
    if (category) {
      query += ' AND s.category = ?';
      params.push(category);
    }

    if (sort === 'deadline') {
      query += ' ORDER BY m.deadline ASC';
    } else {
      query += ' ORDER BY m.created_at DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const meetings = await conn.query(query, params);
    return success(res, meetings);
  } catch (err) {
    console.error('모임 리스트 조회 오류:', err);
    return error(res, '모임 리스트 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 모임 상세 조회
exports.getMeeting = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [meeting] = await conn.query(
      `SELECT m.*, s.name as store_name, s.category as store_category, s.min_order_amount,
              u.nickname as leader_nickname
       FROM meetings m
       JOIN stores s ON m.store_id = s.id
       JOIN users u ON m.leader_id = u.id
       WHERE m.id = ?`,
      [req.params.id]
    );
    if (!meeting) return error(res, '모임을 찾을 수 없습니다.', 404);

    const members = await conn.query(
      `SELECT mm.*, u.nickname, u.profile_image
       FROM meeting_members mm
       JOIN users u ON mm.user_id = u.id
       WHERE mm.meeting_id = ?`,
      [req.params.id]
    );

    // 해당 모임의 주문 항목들
    const orderItems = await conn.query(
      `SELECT oi.*, mn.name as menu_name, u.nickname as orderer_nickname
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN menus mn ON oi.menu_id = mn.id
       JOIN users u ON oi.user_id = u.id
       WHERE o.meeting_id = ?`,
      [req.params.id]
    );

    return success(res, { ...meeting, members, orderItems });
  } catch (err) {
    console.error('모임 상세 조회 오류:', err);
    return error(res, '모임 상세 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 모임 참여 (메뉴 선택 + 결제)
exports.joinMeeting = async (req, res) => {
  let conn;
  try {
    const { menuItems, pointsUsed = 0 } = req.body;
    // menuItems: [{ menuId, quantity, isShared }]
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [meeting] = await conn.query(
      `SELECT m.*, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members
       FROM meetings m WHERE m.id = ?`,
      [req.params.id]
    );

    if (!meeting) return error(res, '모임을 찾을 수 없습니다.', 404);
    if (meeting.status !== 'recruiting') return error(res, '모집 중인 모임이 아닙니다.', 400);
    if (meeting.current_members >= meeting.max_members) return error(res, '최대 인원에 도달했습니다.', 400);
    if (new Date(meeting.deadline) < new Date()) return error(res, '모집 기한이 지났습니다.', 400);

    // 이미 참여 중인지 확인
    const [alreadyJoined] = await conn.query(
      'SELECT id FROM meeting_members WHERE meeting_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (alreadyJoined) return error(res, '이미 참여 중인 모임입니다.', 400);

    // 멤버 추가
    await conn.query(
      'INSERT INTO meeting_members (meeting_id, user_id) VALUES (?, ?)',
      [req.params.id, req.user.id]
    );

    // 주문 생성 또는 기존 주문에 추가
    let [order] = await conn.query('SELECT id FROM orders WHERE meeting_id = ?', [req.params.id]);
    if (!order) {
      const orderResult = await conn.query(
        'INSERT INTO orders (meeting_id, store_id, delivery_fee) VALUES (?, ?, ?)',
        [req.params.id, meeting.store_id, meeting.delivery_fee]
      );
      order = { id: Number(orderResult.insertId) };
    }

    // 메뉴 항목 추가
    let totalMenuPrice = 0;
    if (menuItems && menuItems.length > 0) {
      for (const item of menuItems) {
        const [menu] = await conn.query('SELECT price FROM menus WHERE id = ?', [item.menuId]);
        if (!menu) continue;
        const itemPrice = menu.price * (item.quantity || 1);
        totalMenuPrice += itemPrice;

        await conn.query(
          'INSERT INTO order_items (order_id, user_id, menu_id, quantity, price, is_shared) VALUES (?, ?, ?, ?, ?, ?)',
          [order.id, req.user.id, item.menuId, item.quantity || 1, menu.price, item.isShared ? 1 : 0]
        );
      }
    }

    // 주문 총액 업데이트
    await conn.query(
      'UPDATE orders SET total_amount = total_amount + ? WHERE id = ?',
      [totalMenuPrice, order.id]
    );

    // 결제 기록 생성 (배달비 = 전체 배달비 / 최소 인원)
    const deliveryFeeShare = Math.ceil(meeting.delivery_fee / meeting.min_members);
    const paymentAmount = totalMenuPrice + deliveryFeeShare - pointsUsed;

    await conn.query(
      `INSERT INTO payments (user_id, meeting_id, amount, delivery_fee_share, points_used, status)
       VALUES (?, ?, ?, ?, ?, 'paid')`,
      [req.user.id, req.params.id, paymentAmount, deliveryFeeShare, pointsUsed]
    );

    // 포인트 차감
    if (pointsUsed > 0) {
      await conn.query('UPDATE users SET points = points - ? WHERE id = ?', [pointsUsed, req.user.id]);
      await conn.query(
        `INSERT INTO point_history (user_id, amount, type, description, meeting_id) VALUES (?, ?, 'use', '모임 참여 시 포인트 사용', ?)`,
        [req.user.id, -pointsUsed, req.params.id]
      );
    }

    await conn.commit();
    return success(res, null, '모임에 참여했습니다.');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('모임 참여 오류:', err);
    return error(res, '모임 참여 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 메뉴 취소 (장바구니에서 제거)
exports.cancelMenuItem = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { orderItemId } = req.params;

    const [item] = await conn.query(
      `SELECT oi.*, o.meeting_id FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.id = ? AND oi.user_id = ?`,
      [orderItemId, req.user.id]
    );
    if (!item) return error(res, '주문 항목을 찾을 수 없습니다.', 404);

    const [meeting] = await conn.query('SELECT status FROM meetings WHERE id = ?', [item.meeting_id]);
    if (meeting.status !== 'recruiting') return error(res, '모집 중인 모임에서만 취소할 수 있습니다.', 400);

    await conn.query('DELETE FROM order_items WHERE id = ?', [orderItemId]);
    await conn.query(
      'UPDATE orders SET total_amount = total_amount - ? WHERE id = ?',
      [item.price * item.quantity, item.order_id]
    );

    return success(res, null, '메뉴가 취소되었습니다.');
  } catch (err) {
    console.error('메뉴 취소 오류:', err);
    return error(res, '메뉴 취소 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 모임 상태 변경 (주문 진행 - 마감 시간 도래 후 자동 또는 수동)
exports.processOrder = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [meeting] = await conn.query(
      `SELECT m.*, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members,
              s.min_order_amount
       FROM meetings m JOIN stores s ON m.store_id = s.id WHERE m.id = ?`,
      [req.params.id]
    );

    if (!meeting) return error(res, '모임을 찾을 수 없습니다.', 404);
    if (meeting.leader_id !== req.user.id) return error(res, '모임장만 주문을 진행할 수 있습니다.', 403);
    if (meeting.status !== 'recruiting') return error(res, '모집 중인 모임만 주문할 수 있습니다.', 400);

    // 최소 인원 확인
    if (meeting.current_members < meeting.min_members) {
      // 최소 인원 미달 → 취소
      await conn.query('UPDATE meetings SET status = "cancelled" WHERE id = ?', [req.params.id]);
      await conn.query('UPDATE orders SET status = "cancelled" WHERE meeting_id = ?', [req.params.id]);
      await conn.commit();
      return error(res, '최소 인원이 채워지지 않아 모임이 취소되었습니다.', 400);
    }

    // 최소 주문 금액 확인
    const [order] = await conn.query('SELECT * FROM orders WHERE meeting_id = ?', [req.params.id]);
    if (order && order.total_amount < meeting.min_order_amount) {
      await conn.query('UPDATE meetings SET status = "cancelled" WHERE id = ?', [req.params.id]);
      await conn.query('UPDATE orders SET status = "cancelled" WHERE meeting_id = ?', [req.params.id]);
      await conn.commit();
      return error(res, '최소 주문 금액이 채워지지 않아 모임이 취소되었습니다.', 400);
    }

    // 주문 진행
    await conn.query('UPDATE meetings SET status = "ordered" WHERE id = ?', [req.params.id]);
    await conn.query('UPDATE orders SET status = "pending" WHERE meeting_id = ?', [req.params.id]);

    await conn.commit();
    return success(res, null, '주문이 진행되었습니다.');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('주문 진행 오류:', err);
    return error(res, '주문 진행 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 배달 완료 후 차액 포인트 환급
exports.completeMeeting = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [meeting] = await conn.query(
      `SELECT m.*, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members
       FROM meetings m WHERE m.id = ?`,
      [req.params.id]
    );

    if (!meeting) return error(res, '모임을 찾을 수 없습니다.', 404);

    // 실제 인당 배달비 계산 (실제 인원 기준)
    const actualDeliveryFeePerPerson = Math.ceil(meeting.delivery_fee / meeting.current_members);
    const initialDeliveryFeePerPerson = Math.ceil(meeting.delivery_fee / meeting.min_members);
    const refundPerPerson = initialDeliveryFeePerPerson - actualDeliveryFeePerPerson;

    if (refundPerPerson > 0) {
      const members = await conn.query(
        'SELECT user_id FROM meeting_members WHERE meeting_id = ?',
        [req.params.id]
      );

      for (const member of members) {
        await conn.query('UPDATE users SET points = points + ? WHERE id = ?', [refundPerPerson, member.user_id]);
        await conn.query(
          `INSERT INTO point_history (user_id, amount, type, description, meeting_id) VALUES (?, ?, 'refund', '배달비 차액 환급', ?)`,
          [member.user_id, refundPerPerson, req.params.id]
        );
      }
    }

    await conn.query('UPDATE meetings SET status = "completed" WHERE id = ?', [req.params.id]);
    await conn.query('UPDATE orders SET status = "completed" WHERE meeting_id = ?', [req.params.id]);

    await conn.commit();
    return success(res, { refundPerPerson }, '모임이 완료되었습니다.');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('모임 완료 오류:', err);
    return error(res, '모임 완료 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
