const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const config = require('../config');
const { success, error } = require('../utils/response');
const { generateNickname } = require('../utils/nickname');
const logger = require('../utils/logger');

// Refresh Token 생성 및 DB 저장
async function createRefreshToken(conn, userId) {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30일

  await conn.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );

  return token;
}

// Access Token 생성
function createAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, nickname: user.nickname },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

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

    const userId = Number(result.insertId);
    const accessToken = createAccessToken({ id: userId, email, role: 'user', nickname });
    const refreshToken = await createRefreshToken(conn, userId);

    return success(res, {
      accessToken,
      refreshToken,
      user: { id: userId, email, name, nickname, role: 'user' }
    }, '회원가입 성공', 201);
  } catch (err) {
    logger.error('회원가입 오류:', { error: err.message });
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

    const userId = Number(result.insertId);
    const accessToken = createAccessToken({ id: userId, email, role: 'business', nickname });
    const refreshToken = await createRefreshToken(conn, userId);

    return success(res, {
      accessToken,
      refreshToken,
      user: { id: userId, email, name, nickname, role: 'business' }
    }, '사업자 회원가입 성공', 201);
  } catch (err) {
    logger.error('사업자 회원가입 오류:', { error: err.message });
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

    const accessToken = createAccessToken(user);
    const refreshToken = await createRefreshToken(conn, user.id);

    return success(res, {
      accessToken,
      refreshToken,
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
    logger.error('로그인 오류:', { error: err.message, stack: err.stack });
    return error(res, '로그인 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// Access Token 갱신
exports.refresh = async (req, res) => {
  let conn;
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return error(res, 'Refresh token이 필요합니다.', 400);
    }

    conn = await pool.getConnection();

    // DB에서 refresh token 조회 (유저 정보 JOIN)
    const [tokenRecord] = await conn.query(
      `SELECT rt.*, u.id as user_id, u.email, u.role, u.nickname, u.is_active
       FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id
       WHERE rt.token = ?`,
      [refreshToken]
    );

    if (!tokenRecord) {
      return error(res, '유효하지 않은 refresh token입니다.', 401);
    }

    // 만료 확인
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await conn.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      return error(res, 'Refresh token이 만료되었습니다. 다시 로그인하세요.', 401);
    }

    // 계정 정지 확인
    if (!tokenRecord.is_active) {
      await conn.query('DELETE FROM refresh_tokens WHERE user_id = ?', [tokenRecord.user_id]);
      return error(res, '정지된 계정입니다. 관리자에게 문의하세요.', 403);
    }

    // Refresh Token Rotation: 기존 삭제 후 새로 발급
    await conn.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    const newAccessToken = createAccessToken({
      id: tokenRecord.user_id,
      email: tokenRecord.email,
      role: tokenRecord.role,
      nickname: tokenRecord.nickname,
    });
    const newRefreshToken = await createRefreshToken(conn, tokenRecord.user_id);

    return success(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }, '토큰이 갱신되었습니다.');
  } catch (err) {
    logger.error('토큰 갱신 오류:', { error: err.message, stack: err.stack });
    return error(res, '토큰 갱신 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};

// 로그아웃 (Refresh Token 삭제)
exports.logout = async (req, res) => {
  let conn;
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return success(res, null, '로그아웃 되었습니다.');
    }

    conn = await pool.getConnection();
    await conn.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    return success(res, null, '로그아웃 되었습니다.');
  } catch (err) {
    logger.error('로그아웃 오류:', { error: err.message, stack: err.stack });
    return error(res, '로그아웃 중 오류가 발생했습니다.');
  } finally {
    if (conn) conn.release();
  }
};
