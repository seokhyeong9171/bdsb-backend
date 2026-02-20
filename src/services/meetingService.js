const { Op, fn, col, literal } = require('sequelize');
const logger = require('../utils/logger');
const { sequelize, Meeting, MeetingMember, ChatRoom, Store, User, Order, OrderItem, Menu, Payment, PointHistory } = require('../models');

/**
 * 모임 생성
 */
exports.createMeeting = async (userId, data) => {
  const t = await sequelize.transaction();
  try {
    const {
      storeId, title, diningType, orderType, pickupLocation, meetingLocation,
      minMembers, maxMembers, deliveryFee, allowEarlyOrder, deadline, description, campus
    } = data;

    const meeting = await Meeting.create({
      leaderId: userId, storeId, title, diningType: diningType || 'individual',
      orderType: orderType || 'instant', pickupLocation, meetingLocation: meetingLocation || null,
      minMembers: minMembers || 2, maxMembers: maxMembers || 4, deliveryFee: deliveryFee || 0,
      allowEarlyOrder: allowEarlyOrder || false, deadline, description: description || null,
      campus: campus || null,
    }, { transaction: t });

    // 모임장을 멤버로 추가
    await MeetingMember.create({
      meetingId: meeting.id, userId, isLeader: true,
    }, { transaction: t });

    // 채팅방 자동 생성
    await ChatRoom.create({ meetingId: meeting.id }, { transaction: t });

    await t.commit();
    return { id: meeting.id };
  } catch (err) {
    await t.rollback();
    logger.error('모임 생성 서비스 오류:', { error: err.message, userId });
    throw err;
  }
};

/**
 * 모임 리스트 조회 (모집 중)
 */
exports.listMeetings = async (filters) => {
  try {
    const { campus, category, sort = 'latest', page = 1, limit = 20 } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { status: 'recruiting', deadline: { [Op.gt]: new Date() } };
    if (campus) where.campus = campus;

    const storeWhere = {};
    if (category) storeWhere.category = category;

    const order = sort === 'deadline' ? [['deadline', 'ASC']] : [['createdAt', 'DESC']];

    const meetings = await Meeting.findAll({
      where,
      include: [
        { model: Store, attributes: ['name', 'category', 'thumbnail'], where: Object.keys(storeWhere).length > 0 ? storeWhere : undefined },
        { model: User, as: 'leader', attributes: ['nickname'] },
      ],
      attributes: {
        include: [[literal('(SELECT COUNT(*) FROM meeting_members WHERE meeting_id = `Meeting`.`id`)'), 'currentMembers']],
      },
      order,
      limit: parseInt(limit),
      offset,
    });

    return meetings;
  } catch (err) {
    logger.error('모임 리스트 조회 서비스 오류:', { error: err.message });
    throw err;
  }
};

/**
 * 모임 상세 조회
 */
exports.getMeeting = async (meetingId) => {
  try {
    const meeting = await Meeting.findByPk(meetingId, {
      include: [
        { model: Store, attributes: ['name', 'category', 'minOrderAmount'] },
        { model: User, as: 'leader', attributes: ['nickname'] },
      ],
    });
    if (!meeting) return null;

    const members = await MeetingMember.findAll({
      where: { meetingId },
      include: [{ model: User, attributes: ['nickname', 'profileImage'] }],
    });

    const order = await Order.findOne({ where: { meetingId } });
    let orderItems = [];
    if (order) {
      orderItems = await OrderItem.findAll({
        where: { orderId: order.id },
        include: [
          { model: Menu, attributes: ['name'] },
          { model: User, attributes: ['nickname'] },
        ],
      });
    }

    return { ...meeting.toJSON(), members, orderItems };
  } catch (err) {
    logger.error('모임 상세 조회 서비스 오류:', { error: err.message, meetingId });
    throw err;
  }
};

/**
 * 모임 참여 (메뉴 선택 + 결제)
 */
exports.joinMeeting = async (meetingId, userId, menuItems, pointsUsed = 0) => {
  const t = await sequelize.transaction();
  try {
    const meeting = await Meeting.findByPk(meetingId, { transaction: t });
    const currentMembers = await MeetingMember.count({ where: { meetingId }, transaction: t });

    if (!meeting) throw { status: 404, message: '모임을 찾을 수 없습니다.' };
    if (meeting.status !== 'recruiting') throw { status: 400, message: '모집 중인 모임이 아닙니다.' };
    if (currentMembers >= meeting.maxMembers) throw { status: 400, message: '최대 인원에 도달했습니다.' };
    if (new Date(meeting.deadline) < new Date()) throw { status: 400, message: '모집 기한이 지났습니다.' };

    // 이미 참여 중인지 확인
    const alreadyJoined = await MeetingMember.findOne({
      where: { meetingId, userId }, transaction: t,
    });
    if (alreadyJoined) throw { status: 400, message: '이미 참여 중인 모임입니다.' };

    // 멤버 추가
    await MeetingMember.create({ meetingId, userId }, { transaction: t });

    // 주문 생성 또는 기존 주문에 추가
    const [order] = await Order.findOrCreate({
      where: { meetingId },
      defaults: { meetingId, storeId: meeting.storeId, deliveryFee: meeting.deliveryFee },
      transaction: t,
    });

    // 메뉴 항목 추가
    let totalMenuPrice = 0;
    if (menuItems && menuItems.length > 0) {
      for (const item of menuItems) {
        const menu = await Menu.findByPk(item.menuId, { attributes: ['price'], transaction: t });
        if (!menu) continue;
        const itemPrice = menu.price * (item.quantity || 1);
        totalMenuPrice += itemPrice;

        await OrderItem.create({
          orderId: order.id, userId, menuId: item.menuId,
          quantity: item.quantity || 1, price: menu.price, isShared: item.isShared || false,
        }, { transaction: t });
      }
    }

    // 주문 총액 업데이트
    await order.increment('totalAmount', { by: totalMenuPrice, transaction: t });

    // 결제 기록 생성 (배달비 = 전체 배달비 / 최소 인원)
    const deliveryFeeShare = Math.ceil(meeting.deliveryFee / meeting.minMembers);
    const paymentAmount = totalMenuPrice + deliveryFeeShare - pointsUsed;

    await Payment.create({
      userId, meetingId, amount: paymentAmount,
      deliveryFeeShare, pointsUsed, status: 'paid',
    }, { transaction: t });

    // 포인트 차감
    if (pointsUsed > 0) {
      await User.decrement('points', { by: pointsUsed, where: { id: userId }, transaction: t });
      await PointHistory.create({
        userId, amount: -pointsUsed, type: 'use',
        description: '모임 참여 시 포인트 사용', meetingId,
      }, { transaction: t });
    }

    await t.commit();
    return { meetingId, newMemberCount: currentMembers + 1 };
  } catch (err) {
    await t.rollback();
    if (err.status) throw err;
    logger.error('모임 참여 서비스 오류:', { error: err.message, meetingId, userId });
    throw err;
  }
};

/**
 * 메뉴 취소
 */
exports.cancelMenuItem = async (orderItemId, userId) => {
  try {
    const item = await OrderItem.findByPk(orderItemId, {
      include: [{ model: Order, attributes: ['id', 'meetingId'] }],
    });
    if (!item || item.userId !== userId) throw { status: 404, message: '주문 항목을 찾을 수 없습니다.' };

    const meeting = await Meeting.findByPk(item.Order.meetingId, { attributes: ['status'] });
    if (meeting.status !== 'recruiting') throw { status: 400, message: '모집 중인 모임에서만 취소할 수 있습니다.' };

    const refundAmount = item.price * item.quantity;
    await item.destroy();
    await Order.decrement('totalAmount', { by: refundAmount, where: { id: item.Order.id } });

    return true;
  } catch (err) {
    if (err.status) throw err;
    logger.error('메뉴 취소 서비스 오류:', { error: err.message });
    throw err;
  }
};

/**
 * 주문 진행 (모임장)
 */
exports.processOrder = async (meetingId, userId) => {
  const t = await sequelize.transaction();
  try {
    const meeting = await Meeting.findByPk(meetingId, {
      include: [{ model: Store, attributes: ['minOrderAmount'] }],
      transaction: t,
    });
    const currentMembers = await MeetingMember.count({ where: { meetingId }, transaction: t });

    if (!meeting) throw { status: 404, message: '모임을 찾을 수 없습니다.' };
    if (meeting.leaderId !== userId) throw { status: 403, message: '모임장만 주문을 진행할 수 있습니다.' };
    if (meeting.status !== 'recruiting') throw { status: 400, message: '모집 중인 모임만 주문할 수 있습니다.' };

    // 최소 인원 확인
    if (currentMembers < meeting.minMembers) {
      await Meeting.update({ status: 'cancelled' }, { where: { id: meetingId }, transaction: t });
      await Order.update({ status: 'cancelled' }, { where: { meetingId }, transaction: t });
      await t.commit();
      throw { status: 400, message: '최소 인원이 채워지지 않아 모임이 취소되었습니다.', cancelled: true };
    }

    // 최소 주문 금액 확인
    const order = await Order.findOne({ where: { meetingId }, transaction: t });
    if (order && order.totalAmount < meeting.Store.minOrderAmount) {
      await Meeting.update({ status: 'cancelled' }, { where: { id: meetingId }, transaction: t });
      await Order.update({ status: 'cancelled' }, { where: { meetingId }, transaction: t });
      await t.commit();
      throw { status: 400, message: '최소 주문 금액이 채워지지 않아 모임이 취소되었습니다.', cancelled: true };
    }

    // 주문 진행
    await Meeting.update({ status: 'ordered' }, { where: { id: meetingId }, transaction: t });
    await Order.update({ status: 'pending' }, { where: { meetingId }, transaction: t });

    await t.commit();
    return { status: 'ordered' };
  } catch (err) {
    if (!err.cancelled) await t.rollback();
    if (err.status) throw err;
    logger.error('주문 진행 서비스 오류:', { error: err.message, meetingId });
    throw err;
  }
};

/**
 * 모임 완료 (배달 완료 후 차액 포인트 환급)
 */
exports.completeMeeting = async (meetingId) => {
  const t = await sequelize.transaction();
  try {
    const meeting = await Meeting.findByPk(meetingId, { transaction: t });
    if (!meeting) throw { status: 404, message: '모임을 찾을 수 없습니다.' };

    const currentMembers = await MeetingMember.count({ where: { meetingId }, transaction: t });

    // 실제 인당 배달비 계산 (실제 인원 기준)
    const actualDeliveryFeePerPerson = Math.ceil(meeting.deliveryFee / currentMembers);
    const initialDeliveryFeePerPerson = Math.ceil(meeting.deliveryFee / meeting.minMembers);
    const refundPerPerson = initialDeliveryFeePerPerson - actualDeliveryFeePerPerson;

    if (refundPerPerson > 0) {
      const members = await MeetingMember.findAll({
        where: { meetingId }, attributes: ['userId'], transaction: t,
      });

      for (const member of members) {
        await User.increment('points', { by: refundPerPerson, where: { id: member.userId }, transaction: t });
        await PointHistory.create({
          userId: member.userId, amount: refundPerPerson, type: 'refund',
          description: '배달비 차액 환급', meetingId,
        }, { transaction: t });
      }
    }

    await Meeting.update({ status: 'completed' }, { where: { id: meetingId }, transaction: t });
    await Order.update({ status: 'completed' }, { where: { meetingId }, transaction: t });

    await t.commit();
    return { refundPerPerson };
  } catch (err) {
    await t.rollback();
    if (err.status) throw err;
    logger.error('모임 완료 서비스 오류:', { error: err.message, meetingId });
    throw err;
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
