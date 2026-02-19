// conn을 인자로 받아 순수 쿼리만 수행하는 모델
// 커넥션 관리(getConnection/release)는 컨트롤러가 담당

exports.findByEmail = async (conn, email) => {
  const [user] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
  return user || null;
};

exports.findById = async (conn, id) => {
  const [user] = await conn.query(
    `SELECT id, email, name, nickname, phone, role, university, campus, department,
            address, profile_image, points, is_verified, is_active, created_at
     FROM users WHERE id = ?`,
    [id]
  );
  return user || null;
};

exports.findPublicById = async (conn, id) => {
  const [user] = await conn.query(
    'SELECT id, nickname, department, profile_image FROM users WHERE id = ?',
    [id]
  );
  return user || null;
};

exports.findByNickname = async (conn, nickname) => {
  const [user] = await conn.query('SELECT id FROM users WHERE nickname = ?', [nickname]);
  return user || null;
};

exports.findByNicknameExcept = async (conn, nickname, excludeId) => {
  const [user] = await conn.query(
    'SELECT id FROM users WHERE nickname = ? AND id != ?',
    [nickname, excludeId]
  );
  return user || null;
};

exports.getPasswordById = async (conn, id) => {
  const [user] = await conn.query('SELECT password, points FROM users WHERE id = ?', [id]);
  return user || null;
};

exports.create = async (conn, data) => {
  const { email, password, name, nickname, phone, department, address, university, campus, role, businessNumber } = data;
  const result = await conn.query(
    `INSERT INTO users (email, password, name, nickname, phone, department, address, university, campus, role, business_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [email, password, name, nickname, phone, department || null, address || null,
     university || null, campus || null, role || 'user', businessNumber || null]
  );
  return Number(result.insertId);
};

exports.update = async (conn, id, fields) => {
  const { nickname, profileImage } = fields;
  await conn.query(
    `UPDATE users SET nickname = COALESCE(?, nickname), profile_image = COALESCE(?, profile_image) WHERE id = ?`,
    [nickname || null, profileImage || null, id]
  );
};

exports.updateByAdmin = async (conn, id, fields) => {
  const { department, isActive } = fields;
  await conn.query(
    `UPDATE users SET department = COALESCE(?, department), is_active = COALESCE(?, is_active) WHERE id = ?`,
    [department, isActive !== undefined ? (isActive ? 1 : 0) : null, id]
  );
};

exports.deleteById = async (conn, id) => {
  await conn.query('DELETE FROM users WHERE id = ?', [id]);
};

exports.getActiveStatus = async (conn, id) => {
  const [user] = await conn.query('SELECT is_active FROM users WHERE id = ?', [id]);
  return user || null;
};

exports.toggleActive = async (conn, id, isActive) => {
  await conn.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, id]);
};

exports.addPoints = async (conn, id, amount) => {
  await conn.query('UPDATE users SET points = points + ? WHERE id = ?', [amount, id]);
};

exports.subtractPoints = async (conn, id, amount) => {
  await conn.query('UPDATE users SET points = points - ? WHERE id = ?', [amount, id]);
};

exports.getCompletedMeetingCount = async (conn, userId) => {
  const [row] = await conn.query(
    `SELECT COUNT(*) as count FROM meeting_members mm
     JOIN meetings m ON mm.meeting_id = m.id
     WHERE mm.user_id = ? AND m.status = 'completed'`,
    [userId]
  );
  return row?.count || 0;
};

exports.getActiveMeetingCount = async (conn, userId) => {
  const [row] = await conn.query(
    `SELECT COUNT(*) as count FROM meeting_members mm
     JOIN meetings m ON mm.meeting_id = m.id
     WHERE mm.user_id = ? AND m.status NOT IN ('completed', 'cancelled')`,
    [userId]
  );
  return row?.count || 0;
};

exports.getBadges = async (conn, userId) => {
  return await conn.query(
    'SELECT badge, COUNT(*) as count FROM evaluations WHERE target_id = ? GROUP BY badge',
    [userId]
  );
};

exports.getOrderHistory = async (conn, userId, limit, offset) => {
  return await conn.query(
    `SELECT o.id, o.status, o.total_amount, o.delivery_fee, o.created_at,
            s.name as store_name, s.thumbnail as store_thumbnail,
            m.title as meeting_title, m.dining_type
     FROM payments p
     JOIN meetings m ON p.meeting_id = m.id
     JOIN orders o ON o.meeting_id = m.id
     JOIN stores s ON o.store_id = s.id
     WHERE p.user_id = ?
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
};

exports.search = async (conn, { role, search, limit, offset }) => {
  let query = 'SELECT id, email, name, nickname, phone, role, department, is_active, created_at FROM users WHERE 1=1';
  const params = [];

  if (role) {
    query += ' AND role = ?';
    params.push(role);
  }
  if (search) {
    query += ' AND (name LIKE ? OR email LIKE ? OR nickname LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await conn.query(query, params);
};
