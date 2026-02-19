const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const config = require('../config');
const { success, error } = require('../utils/response');
const { generateNickname } = require('../utils/nickname');

// 유저 회원가입
exports.register = async (req, res) => {
  let conn;
  try {
    const { email, password, name, phone, department, address, university, campus } = req.body;
    conn = await pool.getConnection();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return error(res, '이미 가입된 이메일입니다.', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let nickname = generateNickname();

    // 닉네임 중복 체크 후 재생성
    let attempts = 0;
    while (attempts < 5) {
      const [dup] = await conn.query('SELECT id FROM users WHERE nickname = ?', [nickname]);
      if (!dup) break;
      nickname = generateNickname();
      attempts++;
    }

    const result = await conn.query(
      `INSERT INTO users (email, password, name, nickname, phone, department, address, university, campus, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user')`,
      [email, hashedPassword, name, nickname, phone, department || null, address || null, university || null, campus || null]
    );

    const token = jwt.sign(
      { id: Number(result.insertId), email, role: 'user', nickname },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return success(res, { token, user: { id: Number(result.insertId), email, name, nickname, role: 'user' } }, '회원가입 성공', 201);
  } catch (err) {
    console.error('회원가입 오류:', err);
    return error(res, '회원가입 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 사업자 회원가입
exports.registerBusiness = async (req, res) => {
  let conn;
  try {
    const { email, password, name, phone, businessNumber, address } = req.body;
    conn = await pool.getConnection();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return error(res, '이미 가입된 이메일입니다.', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nickname = generateNickname();

    const result = await conn.query(
      `INSERT INTO users (email, password, name, nickname, phone, address, business_number, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'business')`,
      [email, hashedPassword, name, nickname, phone, address || null, businessNumber]
    );

    const token = jwt.sign(
      { id: Number(result.insertId), email, role: 'business', nickname },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return success(res, { token, user: { id: Number(result.insertId), email, name, nickname, role: 'business' } }, '사업자 회원가입 성공', 201);
  } catch (err) {
    console.error('사업자 회원가입 오류:', err);
    return error(res, '회원가입 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 로그인
exports.login = async (req, res) => {
  let conn;
  try {
    const { email, password } = req.body;
    conn = await pool.getConnection();

    const [user] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return error(res, '이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }

    if (!user.is_active) {
      return error(res, '정지된 계정입니다. 관리자에게 문의하세요.', 403);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return error(res, '이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, nickname: user.nickname },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return success(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        role: user.role,
        university: user.university,
        campus: user.campus,
      }
    }, '로그인 성공');
  } catch (err) {
    console.error('로그인 오류:', err);
    return error(res, '로그인 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
