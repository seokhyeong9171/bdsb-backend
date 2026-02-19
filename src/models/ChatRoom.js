exports.create = async (conn, meetingId) => {
  const result = await conn.query(
    'INSERT INTO chat_rooms (meeting_id) VALUES (?)',
    [meetingId]
  );
  return Number(result.insertId);
};

exports.findByMeeting = async (conn, meetingId) => {
  const [room] = await conn.query(
    'SELECT * FROM chat_rooms WHERE meeting_id = ?',
    [meetingId]
  );
  return room || null;
};
