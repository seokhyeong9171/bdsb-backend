exports.create = async (conn, data) => {
  const { userId, title, content } = data;
  const result = await conn.query(
    'INSERT INTO inquiries (user_id, title, content) VALUES (?, ?, ?)',
    [userId, title, content]
  );
  return Number(result.insertId);
};

exports.findById = async (conn, id) => {
  const [inquiry] = await conn.query('SELECT * FROM inquiries WHERE id = ?', [id]);
  return inquiry || null;
};

exports.findByUser = async (conn, userId) => {
  return await conn.query(
    'SELECT id, title, status, created_at, answered_at FROM inquiries WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
};

exports.search = async (conn, { status, limit, offset }) => {
  let query = `
    SELECT i.*, u.name as user_name, u.nickname as user_nickname
    FROM inquiries i
    JOIN users u ON i.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND i.status = ?';
    params.push(status);
  }

  query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await conn.query(query, params);
};

exports.answer = async (conn, id, answer, answeredBy) => {
  await conn.query(
    `UPDATE inquiries SET answer = ?, status = 'answered', answered_at = NOW(), answered_by = ? WHERE id = ?`,
    [answer, answeredBy, id]
  );
};
