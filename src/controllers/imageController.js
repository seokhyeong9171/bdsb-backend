const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const config = require('../config');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// 이미지 등록
exports.uploadImage = async (req, res) => {
  let conn;
  try {
    if (!req.file) return error(res, '이미지 파일이 필요합니다.', 400);

    const { targetType, targetId } = req.body;
    conn = await pool.getConnection();

    const url = `/uploads/${req.file.filename}`;
    const result = await conn.query(
      'INSERT INTO images (uploader_id, target_type, target_id, url) VALUES (?, ?, ?, ?)',
      [req.user.id, targetType, targetId, url]
    );

    return success(res, { id: Number(result.insertId), url }, '이미지가 등록되었습니다.', 201);
  } catch (err) {
    logger.error('이미지 등록 오류:', { error: err.message });
    return error(res, '이미지 등록 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 이미지 목록 조회
exports.getImages = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { targetType, targetId } = req.query;

    let query = 'SELECT * FROM images WHERE uploader_id = ?';
    const params = [req.user.id];

    if (targetType) {
      query += ' AND target_type = ?';
      params.push(targetType);
    }
    if (targetId) {
      query += ' AND target_id = ?';
      params.push(targetId);
    }

    const images = await conn.query(query, params);
    return success(res, images);
  } catch (err) {
    logger.error('이미지 조회 오류:', { error: err.message });
    return error(res, '이미지 조회 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 대표 이미지 설정
exports.setThumbnail = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { id } = req.params;

    const [image] = await conn.query('SELECT * FROM images WHERE id = ? AND uploader_id = ?', [id, req.user.id]);
    if (!image) return error(res, '이미지를 찾을 수 없습니다.', 404);

    // 같은 대상의 기존 대표 이미지 해제
    await conn.query(
      'UPDATE images SET is_thumbnail = 0 WHERE target_type = ? AND target_id = ? AND uploader_id = ?',
      [image.target_type, image.target_id, req.user.id]
    );

    // 대표 이미지 설정
    await conn.query('UPDATE images SET is_thumbnail = 1 WHERE id = ?', [id]);

    // 가게인 경우 썸네일 업데이트
    if (image.target_type === 'store') {
      await conn.query('UPDATE stores SET thumbnail = ? WHERE id = ?', [image.url, image.target_id]);
    } else if (image.target_type === 'menu') {
      await conn.query('UPDATE menus SET image = ? WHERE id = ?', [image.url, image.target_id]);
    }

    return success(res, null, '대표 이미지가 설정되었습니다.');
  } catch (err) {
    logger.error('대표 이미지 설정 오류:', { error: err.message });
    return error(res, '대표 이미지 설정 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 이미지 삭제
exports.deleteImage = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { id } = req.params;

    const [image] = await conn.query('SELECT * FROM images WHERE id = ? AND uploader_id = ?', [id, req.user.id]);
    if (!image) return error(res, '이미지를 찾을 수 없습니다.', 404);

    await conn.query('DELETE FROM images WHERE id = ?', [id]);

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
  } finally {
    if (conn) conn.release();
  }
};
