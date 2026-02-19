exports.create = async (conn, data) => {
  const { roomId, senderId, message } = data;
  const result = await conn.query(
    'INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)',
    [roomId, senderId, message]
  );
  return Number(result.insertId);
};

exports.findByRoom = async (conn, roomId, limit, offset) => {
  return await conn.query(
    `SELECT cm.*, u.nickname, u.profile_image
     FROM chat_messages cm
     JOIN users u ON cm.sender_id = u.id
     WHERE cm.room_id = ?
     ORDER BY cm.created_at DESC
     LIMIT ? OFFSET ?`,
    [roomId, limit, offset]
  );
};
