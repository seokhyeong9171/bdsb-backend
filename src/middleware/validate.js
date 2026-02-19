const { validationResult } = require('express-validator');
const { error } = require('../utils/response');

module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, '입력값이 올바르지 않습니다.', 400, errors.array());
  }
  next();
};
