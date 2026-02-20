const { Op } = require('sequelize');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { User, Inquiry, Notification } = require('../models');

// 회원 목록 조회
exports.getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { nickname: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await User.findAll({
      where,
      attributes: ['id', 'email', 'name', 'nickname', 'phone', 'role', 'department', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });
    return success(res, users);
  } catch (err) {
    logger.error('회원 목록 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '회원 목록 조회 중 오류가 발생했습니다.');
  }
};

// 회원 정보 수정 (관리자)
exports.updateUser = async (req, res) => {
  try {
    const { department, isActive } = req.body;

    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, '사용자를 찾을 수 없습니다.', 404);

    const updateData = {};
    if (department !== undefined) updateData.department = department;
    if (isActive !== undefined) updateData.isActive = isActive;

    await user.update(updateData);
    return success(res, null, '회원 정보가 수정되었습니다.');
  } catch (err) {
    logger.error('회원 수정 오류:', { error: err.message, stack: err.stack });
    return error(res, '회원 수정 중 오류가 발생했습니다.');
  }
};

// 계정 정지/해제
exports.toggleSuspend = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'isActive'] });
    if (!user) return error(res, '사용자를 찾을 수 없습니다.', 404);

    const newStatus = !user.isActive;
    await user.update({ isActive: newStatus });

    return success(res, { isActive: newStatus }, newStatus ? '계정이 활성화되었습니다.' : '계정이 정지되었습니다.');
  } catch (err) {
    logger.error('계정 정지 처리 오류:', { error: err.message, stack: err.stack });
    return error(res, '계정 정지 처리 중 오류가 발생했습니다.');
  }
};

// 문의 목록 조회 (관리자)
exports.getInquiries = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;

    const inquiries = await Inquiry.findAll({
      where,
      include: [{ model: User, attributes: ['name', 'nickname'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });
    return success(res, inquiries);
  } catch (err) {
    logger.error('문의 목록 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '문의 목록 조회 중 오류가 발생했습니다.');
  }
};

// 문의 답변 (관리자)
exports.answerInquiry = async (req, res) => {
  try {
    const { answer } = req.body;

    const inquiry = await Inquiry.findByPk(req.params.id);
    if (!inquiry) return error(res, '문의를 찾을 수 없습니다.', 404);
    if (inquiry.status === 'answered') return error(res, '이미 답변된 문의입니다.', 400);

    await inquiry.update({
      answer, status: 'answered', answeredAt: new Date(), answeredBy: req.user.id,
    });

    // 문의자에게 알림
    await Notification.create({
      userId: inquiry.userId, type: 'system',
      title: '문의 답변 완료', content: '문의하신 내용에 답변이 등록되었습니다.',
      referenceId: inquiry.id, referenceType: 'inquiry',
    });

    return success(res, null, '답변이 등록되었습니다.');
  } catch (err) {
    logger.error('답변 등록 오류:', { error: err.message, stack: err.stack });
    return error(res, '답변 등록 중 오류가 발생했습니다.');
  }
};
