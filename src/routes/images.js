const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const imageController = require('../controllers/imageController');

// 이미지 등록
router.post('/', authenticate, authorize('business'), upload.single('image'), imageController.uploadImage);

// 이미지 목록 조회
router.get('/', authenticate, authorize('business'), imageController.getImages);

// 대표 이미지 설정
router.put('/:id/thumbnail', authenticate, authorize('business'), imageController.setThumbnail);

// 이미지 삭제
router.delete('/:id', authenticate, authorize('business'), imageController.deleteImage);

module.exports = router;
