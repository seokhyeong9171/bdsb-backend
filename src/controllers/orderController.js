const { sequelize, Order, Store, Meeting, MeetingMember, Payment, User, PointHistory, Notification, OrderItem, Menu } = require('../models');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// 사업자: 주문 목록 조회
exports.getStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findByPk(storeId, { attributes: ['ownerId'] });
    if (!store || store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    const orders = await Order.findAll({
      where: { storeId },
      include: [
        {
          model: Meeting,
          attributes: ['title', 'pickupLocation', 'diningType'],
          include: [{ model: MeetingMember, attributes: [] }],
        },
      ],
      attributes: {
        include: [
          [sequelize.literal('(SELECT COUNT(*) FROM meeting_members WHERE meeting_id = `Order`.`meeting_id`)'), 'memberCount'],
        ],
      },
      order: [['createdAt', 'DESC']],
    });

    return success(res, orders);
  } catch (err) {
    logger.error('주문 목록 조회 오류:', { error: err.message });
    return error(res, '주문 목록 조회 중 오류가 발생했습니다.');
  }
};

// 사업자: 주문 승인
exports.approveOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      include: [{ model: Store, attributes: ['ownerId'] }],
    });
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);
    if (order.Store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await order.update({ status: 'approved' });
    await Meeting.update({ status: 'cooking' }, { where: { id: order.meetingId } });

    // Socket.IO: 주문 승인 실시간 이벤트
    const { emitToMeetingRoom } = require('../app');
    emitToMeetingRoom(order.meetingId, 'order:approved', {
      orderId,
      meetingId: order.meetingId,
      status: 'cooking',
    });

    return success(res, null, '주문이 승인되었습니다.');
  } catch (err) {
    logger.error('주문 승인 오류:', { error: err.message });
    return error(res, '주문 승인 중 오류가 발생했습니다.');
  }
};

// 사업자: 주문 거절 + 환불 처리
exports.rejectOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      include: [{ model: Store, attributes: ['ownerId'] }],
      transaction: t,
    });
    if (!order) { await t.rollback(); return error(res, '주문을 찾을 수 없습니다.', 404); }
    if (order.Store.ownerId !== req.user.id) { await t.rollback(); return error(res, '권한이 없습니다.', 403); }

    await order.update({ status: 'rejected' }, { transaction: t });
    await Meeting.update({ status: 'cancelled' }, { where: { id: order.meetingId }, transaction: t });

    // 결제 환불 처리: 모임 참여자들의 포인트 환급
    const payments = await Payment.findAll({
      where: { meetingId: order.meetingId, status: 'paid' },
      transaction: t,
    });

    for (const payment of payments) {
      await payment.update({ status: 'refunded' }, { transaction: t });

      // 사용했던 포인트 복구
      if (payment.pointsUsed > 0) {
        await User.increment('points', { by: payment.pointsUsed, where: { id: payment.userId }, transaction: t });
        await PointHistory.create({
          userId: payment.userId, amount: payment.pointsUsed, type: 'refund',
          description: '주문 거절로 인한 포인트 환급', meetingId: order.meetingId,
        }, { transaction: t });
      }

      // 배달비 분담금 포인트로 환급
      if (payment.deliveryFeeShare > 0) {
        await User.increment('points', { by: payment.deliveryFeeShare, where: { id: payment.userId }, transaction: t });
        await PointHistory.create({
          userId: payment.userId, amount: payment.deliveryFeeShare, type: 'refund',
          description: '주문 거절로 인한 배달비 환급', meetingId: order.meetingId,
        }, { transaction: t });
      }

      // 모임원에게 알림
      await Notification.create({
        userId: payment.userId, type: 'order', title: '주문 거절',
        content: '가게 사정으로 주문이 거절되었습니다. 결제 금액이 포인트로 환급됩니다.',
        referenceId: orderId, referenceType: 'order',
      }, { transaction: t });

      // Socket.IO: 실시간 알림
      const { emitToUser } = require('../app');
      emitToUser(payment.userId, 'notification:new', {
        type: 'order',
        title: '주문 거절',
        content: '가게 사정으로 주문이 거절되었습니다. 결제 금액이 포인트로 환급됩니다.',
      });
    }

    await t.commit();

    // Socket.IO: 주문 거절 실시간 이벤트
    const { emitToMeetingRoom } = require('../app');
    emitToMeetingRoom(order.meetingId, 'order:rejected', {
      orderId,
      meetingId: order.meetingId,
      status: 'cancelled',
    });

    return success(res, null, '주문이 거절되었습니다. 참여자에게 환불이 진행됩니다.');
  } catch (err) {
    await t.rollback();
    logger.error('주문 거절 오류:', { error: err.message });
    return error(res, '주문 거절 중 오류가 발생했습니다.');
  }
};

// 사업자: 조리 완료 (→ 라이더 배차 요청)
exports.completeCoking = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      include: [{ model: Store, attributes: ['ownerId'] }],
    });
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);
    if (order.Store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await order.update({ status: 'cooked' });
    await Meeting.update({ status: 'delivering' }, { where: { id: order.meetingId } });

    // 모임원에게 알림
    const members = await MeetingMember.findAll({
      where: { meetingId: order.meetingId },
      attributes: ['userId'],
    });

    const notifications = members.map(m => ({
      userId: m.userId, type: 'order', title: '조리 완료',
      content: '주문하신 음식 조리가 완료되었습니다. 곧 배달이 시작됩니다.',
      referenceId: orderId, referenceType: 'order',
    }));
    await Notification.bulkCreate(notifications);

    const { emitToUser, emitToMeetingRoom } = require('../app');
    for (const member of members) {
      emitToUser(member.userId, 'notification:new', {
        type: 'order', title: '조리 완료',
        content: '주문하신 음식 조리가 완료되었습니다.',
      });
    }

    emitToMeetingRoom(order.meetingId, 'meeting:status_changed', {
      meetingId: order.meetingId, status: 'delivering',
    });

    return success(res, null, '조리 완료 처리되었습니다. 라이더 배차를 요청합니다.');
  } catch (err) {
    logger.error('조리 완료 처리 오류:', { error: err.message });
    return error(res, '조리 완료 처리 중 오류가 발생했습니다.');
  }
};

// 사업자: 지연 사유 전달
exports.notifyDelay = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findByPk(orderId, {
      include: [{ model: Store, attributes: ['ownerId'] }],
    });
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);
    if (order.Store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await order.update({ delayReason: reason });

    const members = await MeetingMember.findAll({
      where: { meetingId: order.meetingId },
      attributes: ['userId'],
    });

    const notifications = members.map(m => ({
      userId: m.userId, type: 'order', title: '배달 지연 안내',
      content: reason, referenceId: orderId, referenceType: 'order',
    }));
    await Notification.bulkCreate(notifications);

    const { emitToUser } = require('../app');
    for (const member of members) {
      emitToUser(member.userId, 'notification:new', {
        type: 'order', title: '배달 지연 안내', content: reason,
      });
    }

    return success(res, null, '지연 사유가 전달되었습니다.');
  } catch (err) {
    logger.error('지연 사유 전달 오류:', { error: err.message });
    return error(res, '지연 사유 전달 중 오류가 발생했습니다.');
  }
};

// 라이더: 배차 대기 주문 목록
exports.getAvailableDeliveries = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { status: 'cooked', riderId: null },
      include: [
        { model: Store, attributes: ['name', 'address'] },
        { model: Meeting, attributes: ['pickupLocation', 'meetingLocation'] },
      ],
      order: [['createdAt', 'ASC']],
    });
    return success(res, orders);
  } catch (err) {
    logger.error('배차 목록 조회 오류:', { error: err.message });
    return error(res, '배차 목록 조회 중 오류가 발생했습니다.');
  }
};

// 라이더: 배차 등록
exports.acceptDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ where: { id: orderId, status: 'cooked' } });
    if (!order) return error(res, '배차 가능한 주문이 아닙니다.', 404);
    if (order.riderId) return error(res, '이미 배차된 주문입니다.', 400);

    await order.update({ riderId: req.user.id, status: 'delivering' });

    return success(res, null, '배차가 등록되었습니다.');
  } catch (err) {
    logger.error('배차 등록 오류:', { error: err.message });
    return error(res, '배차 등록 중 오류가 발생했습니다.');
  }
};

// 라이더: 배달 완료
exports.completeDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ where: { id: orderId, riderId: req.user.id } });
    if (!order) return error(res, '주문을 찾을 수 없습니다.', 404);

    await order.update({ status: 'delivered' });
    await Meeting.update({ status: 'delivered' }, { where: { id: order.meetingId } });

    // 모임원에게 알림
    const members = await MeetingMember.findAll({
      where: { meetingId: order.meetingId },
      attributes: ['userId'],
    });

    const notifications = members.map(m => ({
      userId: m.userId, type: 'delivery', title: '배달 완료',
      content: '주문하신 음식이 도착했습니다!',
      referenceId: orderId, referenceType: 'order',
    }));
    await Notification.bulkCreate(notifications);

    const { emitToUser, emitToMeetingRoom } = require('../app');
    for (const member of members) {
      emitToUser(member.userId, 'notification:new', {
        type: 'delivery', title: '배달 완료',
        content: '주문하신 음식이 도착했습니다!',
      });
    }

    emitToMeetingRoom(order.meetingId, 'meeting:status_changed', {
      meetingId: order.meetingId, status: 'delivered',
    });

    return success(res, null, '배달 완료 처리되었습니다.');
  } catch (err) {
    logger.error('배달 완료 처리 오류:', { error: err.message });
    return error(res, '배달 완료 처리 중 오류가 발생했습니다.');
  }
};
