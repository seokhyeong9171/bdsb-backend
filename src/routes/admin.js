const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// 관리자 전용 미들웨어
router.use(authenticate, authorize('admin'));

// 회원 관리
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.post('/users/:id/suspend', adminController.toggleSuspend);

// 문의 관리
router.get('/inquiries', adminController.getInquiries);
router.post('/inquiries/:id/answer', [
  body('answer').notEmpty().withMessage('답변 내용을 입력하세요.'),
], validate, adminController.answerInquiry);

module.exports = router;
