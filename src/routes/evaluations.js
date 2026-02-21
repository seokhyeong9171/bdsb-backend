const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const evaluationController = require('../controllers/evaluationController');

// 평가 대상 목록
router.get('/:meetingId/targets', authenticate, evaluationController.getEvaluationTargets);

// 평가하기 (배열)
router.post('/:meetingId', authenticate, [
  body('evaluations').isArray({ min: 1 }).withMessage('평가 목록이 필요합니다.'),
  body('evaluations.*.targetId').isInt().withMessage('평가 대상을 선택하세요.'),
  body('evaluations.*.badge').isIn(['good', 'normal', 'bad']).withMessage('올바른 평가를 선택하세요.'),
], validate, evaluationController.evaluate);

module.exports = router;
