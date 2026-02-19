exports.create = async (conn, data) => {
  const { userId, type, title, content, referenceId, referenceType } = data;
  await conn.query(
    `INSERT INTO notifications (user_id, type, title, content, reference_id, reference_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type || 'system', title, content || null, referenceId || null, referenceType || null]
  );
};

exports.createForMembers = async (conn, members, data) => {
  const { type, title, content, referenceId, referenceType } = data;
  for (const member of members) {
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, content, reference_id, reference_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [member.user_id, type || 'system', title, content || null, referenceId || null, referenceType || null]
    );
  }
};

exports.findByUser = async (conn, userId, limit, offset) => {
  return await conn.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
};

exports.getUnreadCount = async (conn, userId) => {
  const [row] = await conn.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return row?.count || 0;
};

exports.markAsRead = async (conn, id, userId) => {
  await conn.query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [id, userId]
  );
};

exports.markAllAsRead = async (conn, userId) => {
  await conn.query(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [userId]
  );
};
