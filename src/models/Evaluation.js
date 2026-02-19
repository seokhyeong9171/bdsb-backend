exports.upsert = async (conn, data) => {
  const { meetingId, evaluatorId, targetId, badge } = data;
  await conn.query(
    `INSERT INTO evaluations (meeting_id, evaluator_id, target_id, badge)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE badge = ?`,
    [meetingId, evaluatorId, targetId, badge, badge]
  );
};

exports.getTargets = async (conn, meetingId, evaluatorId) => {
  return await conn.query(
    `SELECT u.id, u.nickname, u.profile_image,
            (SELECT badge FROM evaluations WHERE meeting_id = ? AND evaluator_id = ? AND target_id = u.id) as my_evaluation
     FROM meeting_members mm
     JOIN users u ON mm.user_id = u.id
     WHERE mm.meeting_id = ? AND mm.user_id != ?`,
    [meetingId, evaluatorId, meetingId, evaluatorId]
  );
};
