const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { Store, Menu, Image, User, Order } = require('../models');

// 가게 등록
exports.createStore = async (req, res) => {
  try {
    const { name, description, category, phone, address, openTime, closeTime, closedDays, deliveryFee, minOrderAmount } = req.body;

    const store = await Store.create({
      ownerId: req.user.id, name, description: description || null,
      category: category || 'etc', phone: phone || null, address,
      openTime: openTime || null, closeTime: closeTime || null,
      closedDays: closedDays || null, deliveryFee: deliveryFee || 0,
      minOrderAmount: minOrderAmount || 0,
    });

    return success(res, { id: store.id }, '가게가 등록되었습니다.', 201);
  } catch (err) {
    logger.error('가게 등록 오류:', { error: err.message, stack: err.stack });
    return error(res, '가게 등록 중 오류가 발생했습니다.');
  }
};

// 내 가게 목록 조회
exports.getMyStores = async (req, res) => {
  try {
    const stores = await Store.findAll({
      where: { ownerId: req.user.id, isActive: true },
      order: [['createdAt', 'DESC']],
    });
    return success(res, stores);
  } catch (err) {
    logger.error('가게 목록 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '가게 목록 조회 중 오류가 발생했습니다.');
  }
};

// 가게 상세 조회
exports.getStore = async (req, res) => {
  try {
    const store = await Store.findOne({
      where: { id: req.params.id, isActive: true },
    });
    if (!store) return error(res, '가게를 찾을 수 없습니다.', 404);

    const menus = await Menu.findAll({
      where: { storeId: req.params.id, isAvailable: true },
      order: [['name', 'ASC']],
    });

    const images = await Image.findAll({
      where: { targetType: 'store', targetId: req.params.id },
    });

    return success(res, { ...store.toJSON(), menus, images });
  } catch (err) {
    logger.error('가게 상세 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '가게 상세 조회 중 오류가 발생했습니다.');
  }
};

// 가게 목록 조회 (유저용 - 카테고리/검색)
exports.listStores = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    if (category) where.category = category;
    if (search) where.name = { [Op.like]: `%${search}%` };

    const stores = await Store.findAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset,
    });
    return success(res, stores);
  } catch (err) {
    logger.error('가게 목록 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '가게 목록 조회 중 오류가 발생했습니다.');
  }
};

// 가게 수정
exports.updateStore = async (req, res) => {
  try {
    const { name, description, category, phone, address, openTime, closeTime, closedDays, deliveryFee, minOrderAmount } = req.body;

    const store = await Store.findByPk(req.params.id);
    if (!store) return error(res, '가게를 찾을 수 없습니다.', 404);
    if (store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (openTime !== undefined) updateData.openTime = openTime;
    if (closeTime !== undefined) updateData.closeTime = closeTime;
    if (closedDays !== undefined) updateData.closedDays = closedDays;
    if (deliveryFee !== undefined) updateData.deliveryFee = deliveryFee;
    if (minOrderAmount !== undefined) updateData.minOrderAmount = minOrderAmount;

    await store.update(updateData);
    return success(res, null, '가게 정보가 수정되었습니다.');
  } catch (err) {
    logger.error('가게 수정 오류:', { error: err.message, stack: err.stack });
    return error(res, '가게 수정 중 오류가 발생했습니다.');
  }
};

// 가게 삭제
exports.deleteStore = async (req, res) => {
  try {
    const { password } = req.body;

    const store = await Store.findByPk(req.params.id);
    if (!store) return error(res, '가게를 찾을 수 없습니다.', 404);
    if (store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    // 비밀번호 확인
    const user = await User.findByPk(req.user.id, { attributes: ['password'] });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return error(res, '비밀번호가 올바르지 않습니다.', 401);

    // 진행 중인 주문 확인
    const activeOrderCount = await Order.count({
      where: { storeId: req.params.id, status: { [Op.notIn]: ['completed', 'cancelled'] } },
    });
    if (activeOrderCount > 0) {
      return error(res, '진행 중인 주문이 있어 삭제할 수 없습니다.', 400);
    }

    await store.update({ isActive: false });
    return success(res, null, '가게가 삭제되었습니다.');
  } catch (err) {
    logger.error('가게 삭제 오류:', { error: err.message, stack: err.stack });
    return error(res, '가게 삭제 중 오류가 발생했습니다.');
  }
};
