const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { Menu, Store } = require('../models');

// 메뉴 조회 (가게별)
exports.getMenus = async (req, res) => {
  try {
    const menus = await Menu.findAll({
      where: { storeId: req.params.storeId, isAvailable: true },
      order: [['name', 'ASC']],
    });
    return success(res, menus);
  } catch (err) {
    logger.error('메뉴 조회 오류:', { error: err.message, stack: err.stack });
    return error(res, '메뉴 조회 중 오류가 발생했습니다.');
  }
};

// 메뉴 등록
exports.createMenu = async (req, res) => {
  try {
    const { name, price, description } = req.body;
    const storeId = req.params.storeId;

    // 가게 소유 확인
    const store = await Store.findByPk(storeId, { attributes: ['id', 'ownerId'] });
    if (!store) return error(res, '가게를 찾을 수 없습니다.', 404);
    if (store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    const menu = await Menu.create({
      storeId, name, price, description: description || null,
    });

    return success(res, { id: menu.id }, '메뉴가 등록되었습니다.', 201);
  } catch (err) {
    logger.error('메뉴 등록 오류:', { error: err.message, stack: err.stack });
    return error(res, '메뉴 등록 중 오류가 발생했습니다.');
  }
};

// 메뉴 수정
exports.updateMenu = async (req, res) => {
  try {
    const { name, price, description } = req.body;

    const menu = await Menu.findByPk(req.params.id, {
      include: [{ model: Store, attributes: ['ownerId'] }],
    });
    if (!menu) return error(res, '메뉴를 찾을 수 없습니다.', 404);
    if (menu.Store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (description !== undefined) updateData.description = description;

    await menu.update(updateData);
    return success(res, null, '메뉴가 수정되었습니다.');
  } catch (err) {
    logger.error('메뉴 수정 오류:', { error: err.message, stack: err.stack });
    return error(res, '메뉴 수정 중 오류가 발생했습니다.');
  }
};

// 메뉴 삭제
exports.deleteMenu = async (req, res) => {
  try {
    const menu = await Menu.findByPk(req.params.id, {
      include: [{ model: Store, attributes: ['ownerId'] }],
    });
    if (!menu) return error(res, '메뉴를 찾을 수 없습니다.', 404);
    if (menu.Store.ownerId !== req.user.id) return error(res, '권한이 없습니다.', 403);

    await menu.update({ isAvailable: false });
    return success(res, null, '메뉴가 삭제되었습니다.');
  } catch (err) {
    logger.error('메뉴 삭제 오류:', { error: err.message, stack: err.stack });
    return error(res, '메뉴 삭제 중 오류가 발생했습니다.');
  }
};
