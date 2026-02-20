const pool = require('../config/db');
const logger = require('../utils/logger');

/**
 * 모임 생성
 */
exports.createMeeting = async (userId, data) => {
  let conn;
  try {
    const {
      storeId, title, diningType, orderType, pickupLocation, meetingLocation,
      minMembers, maxMembers, deliveryFee, allowEarlyOrder, deadline, description, campus
    } = data;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const result = await conn.query(
      `INSERT INTO meetings (leader_id, store_id, title, dining_type, order_type,
       pickup_location, meeting_location, min_members, max_members, delivery_fee,
       allow_early_order, deadline, description, campus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, storeId, title, diningType || 'individual', orderType || 'instant',
       pickupLocation, meetingLocation || null, minMembers || 2, maxMembers || 4,
       deliveryFee || 0, allowEarlyOrder ? 1 : 0, deadline, description || null, campus || null]
    );

    const meetingId = Number(result.insertId);

    // 모임장을 멤버로 추가
    await conn.query(
      'INSERT INTO meeting_members (meeting_id, user_id, is_leader) VALUES (?, ?, 1)',
      [meetingId, userId]
    );

    // 채팅방 자동 생성
    await conn.query(
      'INSERT INTO chat_rooms (meeting_id) VALUES (?)',
      [meetingId]
    );

    await conn.commit();
    return { id: meetingId };
  } catch (err) {
    if (conn) await conn.rollback();
    logger.error('모임 생성 서비스 오류:', { error: err.message, userId });
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * 모임 리스트 조회 (모집 중)
 */
exports.listMeetings = async (filters) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { campus, category, sort = 'latest', page = 1, limit = 20 } = filters;
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

    return await conn.query(query, params);
  } catch (err) {
    logger.error('모임 리스트 조회 서비스 오류:', { error: err.message });
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * 모임 상세 조회
 */
exports.getMeeting = async (meetingId) => {
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
      [meetingId]
    );
    if (!meeting) return null;

    const members = await conn.query(
      `SELECT mm.*, u.nickname, u.profile_image
       FROM meeting_members mm
       JOIN users u ON mm.user_id = u.id
       WHERE mm.meeting_id = ?`,
      [meetingId]
    );

    const orderItems = await conn.query(
      `SELECT oi.*, mn.name as menu_name, u.nickname as orderer_nickname
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN menus mn ON oi.menu_id = mn.id
       JOIN users u ON oi.user_id = u.id
       WHERE o.meeting_id = ?`,
      [meetingId]
    );

    return { ...meeting, members, orderItems };
  } catch (err) {
    logger.error('모임 상세 조회 서비스 오류:', { error: err.message, meetingId });
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * 모임 참여 (메뉴 선택 + 결제)
 */
exports.joinMeeting = async (meetingId, userId, menuItems, pointsUsed = 0) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [meeting] = await conn.query(
      `SELECT m.*, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members
       FROM meetings m WHERE m.id = ?`,
      [meetingId]
    );

    if (!meeting) throw { status: 404, message: '모임을 찾을 수 없습니다.' };
    if (meeting.status !== 'recruiting') throw { status: 400, message: '모집 중인 모임이 아닙니다.' };
    if (meeting.current_members >= meeting.max_members) throw { status: 400, message: '최대 인원에 도달했습니다.' };
    if (new Date(meeting.deadline) < new Date()) throw { status: 400, message: '모집 기한이 지났습니다.' };

    // 이미 참여 중인지 확인
    const [alreadyJoined] = await conn.query(
      'SELECT id FROM meeting_members WHERE meeting_id = ? AND user_id = ?',
      [meetingId, userId]
    );
    if (alreadyJoined) throw { status: 400, message: '이미 참여 중인 모임입니다.' };

    // 멤버 추가
    await conn.query(
      'INSERT INTO meeting_members (meeting_id, user_id) VALUES (?, ?)',
      [meetingId, userId]
    );

    // 주문 생성 또는 기존 주문에 추가
    let [order] = await conn.query('SELECT id FROM orders WHERE meeting_id = ?', [meetingId]);
    if (!order) {
      const orderResult = await conn.query(
        'INSERT INTO orders (meeting_id, store_id, delivery_fee) VALUES (?, ?, ?)',
        [meetingId, meeting.store_id, meeting.delivery_fee]
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
          [order.id, userId, item.menuId, item.quantity || 1, menu.price, item.isShared ? 1 : 0]
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
      [userId, meetingId, paymentAmount, deliveryFeeShare, pointsUsed]
    );

    // 포인트 차감
    if (pointsUsed > 0) {
      await conn.query('UPDATE users SET points = points - ? WHERE id = ?', [pointsUsed, userId]);
      await conn.query(
        `INSERT INTO point_history (user_id, amount, type, description, meeting_id) VALUES (?, ?, 'use', '모임 참여 시 포인트 사용', ?)`,
        [userId, -pointsUsed, meetingId]
      );
    }

    await conn.commit();
    return { meetingId, newMemberCount: meeting.current_members + 1 };
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.status) throw err;
    logger.error('모임 참여 서비스 오류:', { error: err.message, meetingId, userId });
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * 메뉴 취소
 */
exports.cancelMenuItem = async (orderItemId, userId) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [item] = await conn.query(
      `SELECT oi.*, o.meeting_id FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.id = ? AND oi.user_id = ?`,
      [orderItemId, userId]
    );
    if (!item) throw { status: 404, message: '주문 항목을 찾을 수 없습니다.' };

    const [meeting] = await conn.query('SELECT status FROM meetings WHERE id = ?', [item.meeting_id]);
    if (meeting.status !== 'recruiting') throw { status: 400, message: '모집 중인 모임에서만 취소할 수 있습니다.' };

    await conn.query('DELETE FROM order_items WHERE id = ?', [orderItemId]);
    await conn.query(
      'UPDATE orders SET total_amount = total_amount - ? WHERE id = ?',
      [item.price * item.quantity, item.order_id]
    );

    return true;
  } catch (err) {
    if (err.status) throw err;
    logger.error('메뉴 취소 서비스 오류:', { error: err.message });
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * 주문 진행 (모임장)
 */
exports.processOrder = async (meetingId, userId) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [meeting] = await conn.query(
      `SELECT m.*, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members,
              s.min_order_amount
       FROM meetings m JOIN stores s ON m.store_id = s.id WHERE m.id = ?`,
      [meetingId]
    );

    if (!meeting) throw { status: 404, message: '모임을 찾을 수 없습니다.' };
    if (meeting.leader_id !== userId) throw { status: 403, message: '모임장만 주문을 진행할 수 있습니다.' };
    if (meeting.status !== 'recruiting') throw { status: 400, message: '모집 중인 모임만 주문할 수 있습니다.' };

    // 최소 인원 확인
    if (meeting.current_members < meeting.min_members) {
      await conn.query('UPDATE meetings SET status = "cancelled" WHERE id = ?', [meetingId]);
      await conn.query('UPDATE orders SET status = "cancelled" WHERE meeting_id = ?', [meetingId]);
      await conn.commit();
      throw { status: 400, message: '최소 인원이 채워지지 않아 모임이 취소되었습니다.', cancelled: true };
    }

    // 최소 주문 금액 확인
    const [order] = await conn.query('SELECT * FROM orders WHERE meeting_id = ?', [meetingId]);
    if (order && order.total_amount < meeting.min_order_amount) {
      await conn.query('UPDATE meetings SET status = "cancelled" WHERE id = ?', [meetingId]);
      await conn.query('UPDATE orders SET status = "cancelled" WHERE meeting_id = ?', [meetingId]);
      await conn.commit();
      throw { status: 400, message: '최소 주문 금액이 채워지지 않아 모임이 취소되었습니다.', cancelled: true };
    }

    // 주문 진행
    await conn.query('UPDATE meetings SET status = "ordered" WHERE id = ?', [meetingId]);
    await conn.query('UPDATE orders SET status = "pending" WHERE meeting_id = ?', [meetingId]);

    await conn.commit();
    return { status: 'ordered' };
  } catch (err) {
    if (!err.cancelled && conn) await conn.rollback();
    if (err.status) throw err;
    logger.error('주문 진행 서비스 오류:', { error: err.message, meetingId });
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * 모임 완료 (배달 완료 후 차액 포인트 환급)
 */
exports.completeMeeting = async (meetingId) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [meeting] = await conn.query(
      `SELECT m.*, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members
       FROM meetings m WHERE m.id = ?`,
      [meetingId]
    );

    if (!meeting) throw { status: 404, message: '모임을 찾을 수 없습니다.' };

    // 실제 인당 배달비 계산 (실제 인원 기준)
    const actualDeliveryFeePerPerson = Math.ceil(meeting.delivery_fee / meeting.current_members);
    const initialDeliveryFeePerPerson = Math.ceil(meeting.delivery_fee / meeting.min_members);
    const refundPerPerson = initialDeliveryFeePerPerson - actualDeliveryFeePerPerson;

    if (refundPerPerson > 0) {
      const members = await conn.query(
        'SELECT user_id FROM meeting_members WHERE meeting_id = ?',
        [meetingId]
      );

      for (const member of members) {
        await conn.query('UPDATE users SET points = points + ? WHERE id = ?', [refundPerPerson, member.user_id]);
        await conn.query(
          `INSERT INTO point_history (user_id, amount, type, description, meeting_id) VALUES (?, ?, 'refund', '배달비 차액 환급', ?)`,
          [member.user_id, refundPerPerson, meetingId]
        );
      }
    }

    await conn.query('UPDATE meetings SET status = "completed" WHERE id = ?', [meetingId]);
    await conn.query('UPDATE orders SET status = "completed" WHERE meeting_id = ?', [meetingId]);

    await conn.commit();
    return { refundPerPerson };
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.status) throw err;
    logger.error('모임 완료 서비스 오류:', { error: err.message, meetingId });
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * 배달비 분담 계산 헬퍼
 */
exports.calculateDeliveryFeeShare = (totalDeliveryFee, memberCount) => {
  if (memberCount <= 0) return 0;
  return Math.ceil(totalDeliveryFee / memberCount);
};

/**
 * 배달비 환급 금액 계산 헬퍼
 */
exports.calculateRefund = (totalDeliveryFee, minMembers, actualMembers) => {
  const initialShare = Math.ceil(totalDeliveryFee / minMembers);
  const actualShare = Math.ceil(totalDeliveryFee / actualMembers);
  return Math.max(0, initialShare - actualShare);
};
