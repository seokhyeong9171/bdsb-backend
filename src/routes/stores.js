const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const storeController = require('../controllers/storeController');
const menuController = require('../controllers/menuController');

// 가게 목록 조회 (유저용)
router.get('/', authenticate, storeController.listStores);

// 가게 상세 조회
router.get('/:id', authenticate, storeController.getStore);

// 사업자 전용
router.get('/my/list', authenticate, authorize('business'), storeController.getMyStores);

router.post('/', authenticate, authorize('business'), [
  body('name').notEmpty().withMessage('가게 이름을 입력하세요.'),
  body('address').notEmpty().withMessage('주소를 입력하세요.'),
], validate, storeController.createStore);

router.put('/:id', authenticate, authorize('business'), storeController.updateStore);
router.delete('/:id', authenticate, authorize('business'), storeController.deleteStore);

// 메뉴 라우트 (가게 하위)
router.get('/:storeId/menus', authenticate, menuController.getMenus);

router.post('/:storeId/menus', authenticate, authorize('business'), [
  body('name').notEmpty().withMessage('메뉴 이름을 입력하세요.'),
  body('price').isInt({ min: 0 }).withMessage('가격을 올바르게 입력하세요.'),
], validate, menuController.createMenu);

router.put('/:storeId/menus/:id', authenticate, authorize('business'), menuController.updateMenu);
router.delete('/:storeId/menus/:id', authenticate, authorize('business'), menuController.deleteMenu);

module.exports = router;
