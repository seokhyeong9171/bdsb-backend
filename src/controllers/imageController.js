const fs = require('fs');
const path = require('path');
const config = require('../config');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { Image, Store, Menu } = require('../models');

// 이미지 등록
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return error(res, '이미지 파일이 필요합니다.', 400);

    const { targetType, targetId } = req.body;
    const url = `/uploads/${req.file.filename}`;

    const image = await Image.create({
      uploaderId: req.user.id, targetType, targetId, url,
    });

    return success(res, { id: image.id, url }, '이미지가 등록되었습니다.', 201);
  } catch (err) {
    logger.error('이미지 등록 오류:', { error: err.message });
    return error(res, '이미지 등록 중 오류가 발생했습니다.');
  }
};

// 이미지 목록 조회
exports.getImages = async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    const where = { uploaderId: req.user.id };

    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;

    const images = await Image.findAll({ where });
    return success(res, images);
  } catch (err) {
    logger.error('이미지 조회 오류:', { error: err.message });
    return error(res, '이미지 조회 중 오류가 발생했습니다.');
  }
};

// 대표 이미지 설정
exports.setThumbnail = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await Image.findOne({ where: { id, uploaderId: req.user.id } });
    if (!image) return error(res, '이미지를 찾을 수 없습니다.', 404);

    // 같은 대상의 기존 대표 이미지 해제
    await Image.update(
      { isThumbnail: false },
      { where: { targetType: image.targetType, targetId: image.targetId, uploaderId: req.user.id } }
    );

    // 대표 이미지 설정
    await image.update({ isThumbnail: true });

    // 가게인 경우 썸네일 업데이트
    if (image.targetType === 'store') {
      await Store.update({ thumbnail: image.url }, { where: { id: image.targetId } });
    } else if (image.targetType === 'menu') {
      await Menu.update({ image: image.url }, { where: { id: image.targetId } });
    }

    return success(res, null, '대표 이미지가 설정되었습니다.');
  } catch (err) {
    logger.error('대표 이미지 설정 오류:', { error: err.message });
    return error(res, '대표 이미지 설정 중 오류가 발생했습니다.');
  }
};

// 이미지 삭제
exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await Image.findOne({ where: { id, uploaderId: req.user.id } });
    if (!image) return error(res, '이미지를 찾을 수 없습니다.', 404);

    await image.destroy();

    // 파일 시스템에서 실제 파일 삭제
    const filePath = path.join(__dirname, '..', '..', config.upload.dir, path.basename(image.url));
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr && unlinkErr.code !== 'ENOENT') {
        logger.error('이미지 파일 삭제 실패:', { error: unlinkErr.message, path: filePath });
      }
    });

    return success(res, null, '이미지가 삭제되었습니다.');
  } catch (err) {
    logger.error('이미지 삭제 오류:', { error: err.message });
    return error(res, '이미지 삭제 중 오류가 발생했습니다.');
  }
};
