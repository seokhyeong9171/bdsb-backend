const { Op } = require('sequelize');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { Meeting, MeetingMember, Evaluation, User } = require('../models');

// 평가하기 (배열)
exports.evaluate = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { evaluations } = req.body;

    // 모임 완료 확인
    const meeting = await Meeting.findByPk(meetingId, { attributes: ['status'] });
    if (!meeting || meeting.status !== 'completed') {
      return error(res, '완료된 모임만 평가할 수 있습니다.', 400);
    }

    const targetIds = evaluations.map((e) => e.targetId);

    // 본인 평가 불가
    if (targetIds.includes(req.user.id)) {
      return error(res, '본인은 평가할 수 없습니다.', 400);
    }

    // 모든 대상이 모임 멤버인지 확인
    const memberCount = await MeetingMember.count({
      where: { meetingId, userId: { [Op.in]: [...targetIds, req.user.id] } },
    });
    if (memberCount < targetIds.length + 1) {
      return error(res, '해당 모임의 참여자만 평가할 수 있습니다.', 403);
    }

    await Promise.all(evaluations.map((e) =>
      Evaluation.upsert({
        meetingId, evaluatorId: req.user.id, targetId: e.targetId, badge: e.badge,
      })
    ));

    return success(res, null, '평가가 등록되었습니다.');
  } catch (err) {
    logger.error('평가 오류:', { error: err.message, stack: err.stack });
    return error(res, '평가 중 오류가 발생했습니다.');
  }
};

// 평가 대상 목록 (모임원 리스트)
exports.getEvaluationTargets = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const members = await MeetingMember.findAll({
      where: { meetingId, userId: { [Op.ne]: req.user.id } },
      include: [{ model: User, attributes: ['id', 'nickname', 'profileImage'] }],
    });

    // 각 멤버에 대해 내가 이미 평가한 badge 조회
    const targets = await Promise.all(members.map(async (m) => {
      const evaluation = await Evaluation.findOne({
        where: { meetingId, evaluatorId: req.user.id, targetId: m.User.id },
        attributes: ['badge'],
      });
      return {
        user_id: m.User.id,
        nickname: m.User.nickname,
        profile_image: m.User.profileImage,
        already_evaluated: !!evaluation,
      };
    }));

    return success(res, targets);
  } catch (err) {
    logger.error('평가 대상 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '평가 대상 조회 중 오류가 발생했습니다.');
  }
};
