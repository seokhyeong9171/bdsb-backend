const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

// 사업자 라우트
router.get('/store/:storeId', authenticate, authorize('business'), orderController.getStoreOrders);
router.post('/:orderId/approve', authenticate, authorize('business'), orderController.approveOrder);
router.post('/:orderId/reject', authenticate, authorize('business'), orderController.rejectOrder);
router.post('/:orderId/cooked', authenticate, authorize('business'), orderController.completeCoking);
router.post('/:orderId/delay', authenticate, authorize('business'), orderController.notifyDelay);

// 라이더 라우트
router.get('/deliveries', authenticate, authorize('rider'), orderController.getAvailableDeliveries);
router.post('/:orderId/accept-delivery', authenticate, authorize('rider'), orderController.acceptDelivery);
router.post('/:orderId/complete-delivery', authenticate, authorize('rider'), orderController.completeDelivery);

module.exports = router;
