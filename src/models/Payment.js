exports.create = async (conn, data) => {
  const { userId, meetingId, amount, deliveryFeeShare, pointsUsed } = data;
  const result = await conn.query(
    `INSERT INTO payments (user_id, meeting_id, amount, delivery_fee_share, points_used, status)
     VALUES (?, ?, ?, ?, ?, 'paid')`,
    [userId, meetingId, amount, deliveryFeeShare, pointsUsed]
  );
  return Number(result.insertId);
};
