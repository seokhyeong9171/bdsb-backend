const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.get('/me', authenticate, userController.getProfile);
router.put('/me', authenticate, userController.updateProfile);
router.delete('/me', authenticate, userController.deleteAccount);
router.get('/me/orders', authenticate, userController.getOrderHistory);
router.get('/:id', authenticate, userController.getUserInfo);

module.exports = router;
