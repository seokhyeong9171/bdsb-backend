exports.create = async (conn, data) => {
  const { userId, amount, type, description, meetingId } = data;
  await conn.query(
    'INSERT INTO point_history (user_id, amount, type, description, meeting_id) VALUES (?, ?, ?, ?, ?)',
    [userId, amount, type, description, meetingId || null]
  );
};
