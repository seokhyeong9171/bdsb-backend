exports.add = async (conn, meetingId, userId, isLeader = false) => {
  await conn.query(
    'INSERT INTO meeting_members (meeting_id, user_id, is_leader) VALUES (?, ?, ?)',
    [meetingId, userId, isLeader ? 1 : 0]
  );
};

exports.findByMeetingAndUser = async (conn, meetingId, userId) => {
  const [member] = await conn.query(
    'SELECT id FROM meeting_members WHERE meeting_id = ? AND user_id = ?',
    [meetingId, userId]
  );
  return member || null;
};

exports.findByMeeting = async (conn, meetingId) => {
  return await conn.query(
    'SELECT user_id FROM meeting_members WHERE meeting_id = ?',
    [meetingId]
  );
};

exports.findByMeetingWithProfile = async (conn, meetingId) => {
  return await conn.query(
    `SELECT mm.*, u.nickname, u.profile_image
     FROM meeting_members mm
     JOIN users u ON mm.user_id = u.id
     WHERE mm.meeting_id = ?`,
    [meetingId]
  );
};

exports.findByMeetingForUsers = async (conn, meetingId, userIds) => {
  return await conn.query(
    'SELECT user_id FROM meeting_members WHERE meeting_id = ? AND user_id IN (?, ?)',
    [meetingId, ...userIds]
  );
};
