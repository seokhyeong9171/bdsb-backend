const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const inquiryController = require('../controllers/inquiryController');

// 문의 등록
router.post('/', authenticate, [
  body('title').notEmpty().withMessage('제목을 입력하세요.'),
  body('content').notEmpty().withMessage('내용을 입력하세요.'),
], validate, inquiryController.createInquiry);

// 내 문의 목록
router.get('/my', authenticate, inquiryController.getMyInquiries);

// 문의 상세
router.get('/:id', authenticate, inquiryController.getInquiry);

module.exports = router;
