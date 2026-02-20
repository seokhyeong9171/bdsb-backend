const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const meetingService = require('../services/meetingService');

// 모임 생성
exports.createMeeting = async (req, res) => {
  try {
    const result = await meetingService.createMeeting(req.user.id, req.body);
    return success(res, result, '모임이 생성되었습니다.', 201);
  } catch (err) {
    logger.error('모임 생성 오류:', { error: err.message, userId: req.user.id });
    return error(res, '모임 생성 중 오류가 발생했습니다.');
  }
};

// 모임 리스트 조회 (모집 중인 것)
exports.listMeetings = async (req, res) => {
  try {
    const meetings = await meetingService.listMeetings(req.query);
    return success(res, meetings);
  } catch (err) {
    logger.error('모임 리스트 조회 오류:', { error: err.message });
    return error(res, '모임 리스트 조회 중 오류가 발생했습니다.');
  }
};

// 모임 상세 조회
exports.getMeeting = async (req, res) => {
  try {
    const meeting = await meetingService.getMeeting(req.params.id);
    if (!meeting) return error(res, '모임을 찾을 수 없습니다.', 404);
    return success(res, meeting);
  } catch (err) {
    logger.error('모임 상세 조회 오류:', { error: err.message });
    return error(res, '모임 상세 조회 중 오류가 발생했습니다.');
  }
};

// 모임 참여 (메뉴 선택 + 결제)
exports.joinMeeting = async (req, res) => {
  try {
    const { menuItems, pointsUsed = 0 } = req.body;
    const result = await meetingService.joinMeeting(req.params.id, req.user.id, menuItems, pointsUsed);

    // Socket.IO: 모임 참여 실시간 이벤트
    const { emitToMeetingRoom } = require('../app');
    emitToMeetingRoom(req.params.id, 'meeting:member_joined', {
      meetingId: req.params.id,
      userId: req.user.id,
      nickname: req.user.nickname,
      memberCount: result.newMemberCount,
    });

    return success(res, null, '모임에 참여했습니다.');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    logger.error('모임 참여 오류:', { error: err.message, userId: req.user.id });
    return error(res, '모임 참여 중 오류가 발생했습니다.');
  }
};

// 메뉴 취소 (장바구니에서 제거)
exports.cancelMenuItem = async (req, res) => {
  try {
    await meetingService.cancelMenuItem(req.params.orderItemId, req.user.id);
    return success(res, null, '메뉴가 취소되었습니다.');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    logger.error('메뉴 취소 오류:', { error: err.message });
    return error(res, '메뉴 취소 중 오류가 발생했습니다.');
  }
};

// 모임 상태 변경 (주문 진행)
exports.processOrder = async (req, res) => {
  try {
    await meetingService.processOrder(req.params.id, req.user.id);

    // Socket.IO: 주문 진행 실시간 이벤트
    const { emitToMeetingRoom } = require('../app');
    emitToMeetingRoom(req.params.id, 'meeting:status_changed', {
      meetingId: req.params.id,
      status: 'ordered',
    });

    return success(res, null, '주문이 진행되었습니다.');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    logger.error('주문 진행 오류:', { error: err.message });
    return error(res, '주문 진행 중 오류가 발생했습니다.');
  }
};

// 배달 완료 후 차액 포인트 환급
exports.completeMeeting = async (req, res) => {
  try {
    const result = await meetingService.completeMeeting(req.params.id);

    // Socket.IO: 모임 완료 실시간 이벤트
    const { emitToMeetingRoom } = require('../app');
    emitToMeetingRoom(req.params.id, 'meeting:status_changed', {
      meetingId: req.params.id,
      status: 'completed',
      refundPerPerson: result.refundPerPerson,
    });

    return success(res, result, '모임이 완료되었습니다.');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    logger.error('모임 완료 오류:', { error: err.message });
    return error(res, '모임 완료 중 오류가 발생했습니다.');
  }
};
