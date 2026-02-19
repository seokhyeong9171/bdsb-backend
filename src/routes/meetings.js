const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const meetingController = require('../controllers/meetingController');

// 모임 리스트 조회
router.get('/', authenticate, meetingController.listMeetings);

// 모임 상세 조회
router.get('/:id', authenticate, meetingController.getMeeting);

// 모임 생성
router.post('/', authenticate, [
  body('storeId').isInt().withMessage('가게를 선택하세요.'),
  body('pickupLocation').notEmpty().withMessage('수령 장소를 입력하세요.'),
  body('deadline').isISO8601().withMessage('마감 기한을 올바르게 입력하세요.'),
], validate, meetingController.createMeeting);

// 모임 참여
router.post('/:id/join', authenticate, meetingController.joinMeeting);

// 메뉴 취소
router.delete('/order-items/:orderItemId', authenticate, meetingController.cancelMenuItem);

// 주문 진행 (모임장)
router.post('/:id/order', authenticate, meetingController.processOrder);

// 모임 완료 (배달 완료 후 차액 환급)
router.post('/:id/complete', authenticate, meetingController.completeMeeting);

module.exports = router;
