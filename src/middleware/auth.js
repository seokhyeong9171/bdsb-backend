const jwt = require('jsonwebtoken');
const config = require('../config');
const { error } = require('../utils/response');

// JWT 인증 미들웨어
exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '인증 토큰이 필요합니다.', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return error(res, '유효하지 않은 토큰입니다.', 401);
  }
};

// 역할 확인 미들웨어
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return error(res, '접근 권한이 없습니다.', 403);
    }
    next();
  };
};
