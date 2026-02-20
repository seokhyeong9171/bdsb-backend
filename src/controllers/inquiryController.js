const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { Inquiry } = require('../models');

// 문의 등록
exports.createInquiry = async (req, res) => {
  try {
    const { title, content } = req.body;

    const inquiry = await Inquiry.create({
      userId: req.user.id, title, content,
    });

    return success(res, { id: inquiry.id }, '문의가 등록되었습니다.', 201);
  } catch (err) {
    logger.error('문의 등록 오류:', { error: err.message, stack: err.stack });
    return error(res, '문의 등록 중 오류가 발생했습니다.');
  }
};

// 내 문의 목록 조회
exports.getMyInquiries = async (req, res) => {
  try {
    const rows = await Inquiry.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'title', 'status', 'createdAt', 'answeredAt'],
      order: [['createdAt', 'DESC']],
    });
    const inquiries = rows.map((i) => {
      const j = i.toJSON();
      return {
        id: j.id,
        title: j.title,
        status: j.status,
        created_at: j.createdAt,
        answered_at: j.answeredAt,
      };
    });
    return success(res, inquiries);
  } catch (err) {
    logger.error('문의 목록 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '문의 목록 조회 중 오류가 발생했습니다.');
  }
};

// 문의 상세 조회
exports.getInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findByPk(req.params.id);
    if (!inquiry) return error(res, '문의를 찾을 수 없습니다.', 404);

    // 본인 또는 관리자만 조회 가능
    if (inquiry.userId !== req.user.id && req.user.role !== 'admin') {
      return error(res, '권한이 없습니다.', 403);
    }

    const j = inquiry.toJSON();
    return success(res, {
      id: j.id,
      user_id: j.userId,
      title: j.title,
      content: j.content,
      status: j.status,
      answer: j.answer,
      answered_at: j.answeredAt,
      created_at: j.createdAt,
    });
  } catch (err) {
    logger.error('문의 상세 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '문의 상세 조회 중 오류가 발생했습니다.');
  }
};
