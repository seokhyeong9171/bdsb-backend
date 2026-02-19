const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// 채팅방 조회
router.get('/meeting/:meetingId', authenticate, chatController.getChatRoom);

// 메시지 조회
router.get('/room/:roomId/messages', authenticate, chatController.getMessages);

// 메시지 전송
router.post('/room/:roomId/messages', authenticate, [
  body('message').notEmpty().withMessage('메시지를 입력하세요.'),
], validate, chatController.sendMessage);

module.exports = router;
