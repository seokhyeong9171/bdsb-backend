const xss = require('xss');
const logger = require('../utils/logger');

// XSS Sanitization 옵션
const xssOptions = {
  whiteList: {},          // 허용 태그 없음 (모든 HTML 태그 제거)
  stripIgnoreTag: true,   // 허용되지 않은 태그 제거
  stripIgnoreTagBody: ['script', 'style'], // script, style 태그 내용까지 제거
};

/**
 * 요청 body의 문자열 필드에 XSS 방어 적용
 * 중첩 객체도 재귀적으로 처리
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return xss(value, xssOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    sanitized[key] = sanitizeValue(obj[key]);
  }
  return sanitized;
}

/**
 * Express 미들웨어: req.body 전체 sanitize
 */
function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

module.exports = sanitize;
