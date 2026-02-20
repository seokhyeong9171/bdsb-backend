const bcrypt = require('bcryptjs');
const { Op, fn, col } = require('sequelize');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { User, Meeting, MeetingMember, Evaluation, Payment, Order, Store } = require('../models');

// 내 정보 조회
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'name', 'nickname', 'phone', 'role', 'university', 'campus',
        'department', 'address', 'profileImage', 'points', 'isVerified', 'createdAt'],
    });
    if (!user) return error(res, '사용자를 찾을 수 없습니다.', 404);

    // 완료 모임 수
    const completedMeetings = await MeetingMember.count({
      where: { userId: req.user.id },
      include: [{ model: Meeting, as: 'meeting', where: { status: 'completed' }, attributes: [] }],
    });

    // 평가 뱃지 집계
    const badges = await Evaluation.findAll({
      where: { targetId: req.user.id },
      attributes: ['badge', [fn('COUNT', '*'), 'count']],
      group: ['badge'],
      raw: true,
    });

    return success(res, {
      ...user.toJSON(),
      completed_meetings: completedMeetings,
      badges: badges || [],
    });
  } catch (err) {
    logger.error('프로필 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '프로필 조회 중 오류가 발생했습니다.');
  }
};

// 다른 유저 정보 조회
exports.getUserInfo = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'nickname', 'department', 'profileImage'],
    });
    if (!user) return error(res, '사용자를 찾을 수 없습니다.', 404);

    const completedMeetings = await MeetingMember.count({
      where: { userId: req.params.id },
      include: [{ model: Meeting, as: 'meeting', where: { status: 'completed' }, attributes: [] }],
    });

    const badges = await Evaluation.findAll({
      where: { targetId: req.params.id },
      attributes: ['badge', [fn('COUNT', '*'), 'count']],
      group: ['badge'],
      raw: true,
    });

    return success(res, {
      ...user.toJSON(),
      completed_meetings: completedMeetings,
      badges: badges || [],
    });
  } catch (err) {
    logger.error('유저 정보 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '유저 정보 조회 중 오류가 발생했습니다.');
  }
};

// 내 정보 수정
exports.updateProfile = async (req, res) => {
  try {
    const { currentPassword, nickname, profileImage } = req.body;

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'password'] });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return error(res, '비밀번호가 올바르지 않습니다.', 401);

    if (nickname) {
      const dup = await User.findOne({ where: { nickname, id: { [Op.ne]: req.user.id } } });
      if (dup) return error(res, '이미 사용 중인 닉네임입니다.', 409);
    }

    const updateData = {};
    if (nickname) updateData.nickname = nickname;
    if (profileImage) updateData.profileImage = profileImage;

    await user.update(updateData);
    return success(res, null, '프로필이 수정되었습니다.');
  } catch (err) {
    logger.error('프로필 수정 오류:', { error: err.message, stack: err.stack });
    return error(res, '프로필 수정 중 오류가 발생했습니다.');
  }
};

// 회원 탈퇴
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'password', 'points'] });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return error(res, '비밀번호가 올바르지 않습니다.', 401);

    // 진행 중인 모임 확인
    const activeMeetingCount = await MeetingMember.count({
      where: { userId: req.user.id },
      include: [{ model: Meeting, as: 'meeting', where: { status: { [Op.notIn]: ['completed', 'cancelled'] } }, attributes: [] }],
    });
    if (activeMeetingCount > 0) {
      return error(res, '진행 중인 모임이 있어 탈퇴할 수 없습니다.', 400);
    }

    // 잔여 포인트 확인
    if (user.points > 0) {
      return error(res, '잔여 포인트가 있어 탈퇴할 수 없습니다. 포인트를 먼저 소진하세요.', 400);
    }

    await user.destroy();
    return success(res, null, '회원 탈퇴가 완료되었습니다.');
  } catch (err) {
    logger.error('회원 탈퇴 오류:', { error: err.message, stack: err.stack });
    return error(res, '회원 탈퇴 중 오류가 발생했습니다.');
  }
};

// 주문 내역 조회
exports.getOrderHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Meeting,
        as: 'meeting',
        attributes: ['title', 'diningType'],
        include: [{
          model: Order,
          as: 'order',
          attributes: ['id', 'status', 'totalAmount', 'deliveryFee', 'createdAt'],
          include: [{ model: Store, as: 'store', attributes: ['name', 'thumbnail'] }],
        }],
      }],
      order: [[{ model: Meeting, as: 'meeting' }, { model: Order, as: 'order' }, 'createdAt', 'DESC']],
      limit,
      offset,
    });

    // 평탄화된 응답 생성
    const orders = payments.map(p => ({
      id: p.meeting?.order?.id,
      status: p.meeting?.order?.status,
      totalAmount: p.meeting?.order?.totalAmount,
      deliveryFee: p.meeting?.order?.deliveryFee,
      createdAt: p.meeting?.order?.createdAt,
      storeName: p.meeting?.order?.store?.name,
      storeThumbnail: p.meeting?.order?.store?.thumbnail,
      meetingTitle: p.meeting?.title,
      diningType: p.meeting?.diningType,
    }));

    return success(res, orders);
  } catch (err) {
    logger.error('주문 내역 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '주문 내역 조회 중 오류가 발생했습니다.');
  }
};
