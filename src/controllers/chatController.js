const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { ChatRoom, ChatMessage, MeetingMember, User } = require('../models');

// 채팅방 조회 (모임별)
exports.getChatRoom = async (req, res) => {
  try {
    const { meetingId } = req.params;

    // 참여자 확인
    const member = await MeetingMember.findOne({
      where: { meetingId, userId: req.user.id },
    });
    if (!member) return error(res, '해당 모임의 참여자가 아닙니다.', 403);

    const room = await ChatRoom.findOne({ where: { meetingId } });
    if (!room) return error(res, '채팅방을 찾을 수 없습니다.', 404);

    return success(res, room);
  } catch (err) {
    logger.error('채팅방 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '채팅방 조회 중 오류가 발생했습니다.');
  }
};

// 채팅 메시지 조회
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const messages = await ChatMessage.findAll({
      where: { roomId },
      include: [{ model: User, as: 'sender', attributes: ['nickname', 'profileImage'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return success(res, messages);
  } catch (err) {
    logger.error('메시지 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '메시지 조회 중 오류가 발생했습니다.');
  }
};

// 채팅 메시지 전송 (REST fallback - Socket.IO도 지원)
exports.sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message } = req.body;

    const chatMessage = await ChatMessage.create({
      roomId, senderId: req.user.id, message,
    });

    return success(res, { id: chatMessage.id }, '메시지가 전송되었습니다.', 201);
  } catch (err) {
    logger.error('메시지 전송 오류:', { error: err.message, stack: err.stack });
    return error(res, '메시지 전송 중 오류가 발생했습니다.');
  }
};
