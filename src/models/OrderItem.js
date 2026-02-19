exports.create = async (conn, data) => {
  const { orderId, userId, menuId, quantity, price, isShared } = data;
  const result = await conn.query(
    'INSERT INTO order_items (order_id, user_id, menu_id, quantity, price, is_shared) VALUES (?, ?, ?, ?, ?, ?)',
    [orderId, userId, menuId, quantity || 1, price, isShared ? 1 : 0]
  );
  return Number(result.insertId);
};

exports.findByIdAndUser = async (conn, id, userId) => {
  const [item] = await conn.query(
    `SELECT oi.*, o.meeting_id FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.id = ? AND oi.user_id = ?`,
    [id, userId]
  );
  return item || null;
};

exports.findByMeeting = async (conn, meetingId) => {
  return await conn.query(
    `SELECT oi.*, mn.name as menu_name, u.nickname as orderer_nickname
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN menus mn ON oi.menu_id = mn.id
     JOIN users u ON oi.user_id = u.id
     WHERE o.meeting_id = ?`,
    [meetingId]
  );
};

exports.deleteById = async (conn, id) => {
  await conn.query('DELETE FROM order_items WHERE id = ?', [id]);
};
