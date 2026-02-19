const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');

// 유저 회원가입
router.post('/register', [
  body('email').isEmail().withMessage('유효한 이메일을 입력하세요.'),
  body('password').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자 이상이어야 합니다.'),
  body('name').notEmpty().withMessage('이름을 입력하세요.'),
  body('phone').notEmpty().withMessage('휴대폰번호를 입력하세요.'),
], validate, authController.register);

// 사업자 회원가입
router.post('/register/business', [
  body('email').isEmail().withMessage('유효한 이메일을 입력하세요.'),
  body('password').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자 이상이어야 합니다.'),
  body('name').notEmpty().withMessage('이름을 입력하세요.'),
  body('phone').notEmpty().withMessage('휴대폰번호를 입력하세요.'),
  body('businessNumber').notEmpty().withMessage('사업자번호를 입력하세요.'),
], validate, authController.registerBusiness);

// 로그인
router.post('/login', [
  body('email').isEmail().withMessage('유효한 이메일을 입력하세요.'),
  body('password').notEmpty().withMessage('비밀번호를 입력하세요.'),
], validate, authController.login);

module.exports = router;
