exports.create = async (conn, data) => {
  const { meetingId, storeId, deliveryFee } = data;
  const result = await conn.query(
    'INSERT INTO orders (meeting_id, store_id, delivery_fee) VALUES (?, ?, ?)',
    [meetingId, storeId, deliveryFee]
  );
  return Number(result.insertId);
};

exports.findByMeeting = async (conn, meetingId) => {
  const [order] = await conn.query('SELECT * FROM orders WHERE meeting_id = ?', [meetingId]);
  return order || null;
};

exports.findById = async (conn, id) => {
  const [order] = await conn.query('SELECT * FROM orders WHERE id = ?', [id]);
  return order || null;
};

exports.findByIdWithOwner = async (conn, id) => {
  const [order] = await conn.query(
    'SELECT o.*, s.owner_id FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.id = ?',
    [id]
  );
  return order || null;
};

exports.findByIdCooked = async (conn, id) => {
  const [order] = await conn.query(
    'SELECT * FROM orders WHERE id = ? AND status = "cooked"',
    [id]
  );
  return order || null;
};

exports.findByIdAndRider = async (conn, id, riderId) => {
  const [order] = await conn.query(
    'SELECT * FROM orders WHERE id = ? AND rider_id = ?',
    [id, riderId]
  );
  return order || null;
};

exports.findByStore = async (conn, storeId) => {
  return await conn.query(
    `SELECT o.*, m.title as meeting_title, m.pickup_location, m.dining_type,
            (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as member_count
     FROM orders o
     JOIN meetings m ON o.meeting_id = m.id
     WHERE o.store_id = ?
     ORDER BY o.created_at DESC`,
    [storeId]
  );
};

exports.findAvailableDeliveries = async (conn) => {
  return await conn.query(
    `SELECT o.*, s.name as store_name, s.address as store_address,
            m.pickup_location, m.meeting_location
     FROM orders o
     JOIN stores s ON o.store_id = s.id
     JOIN meetings m ON o.meeting_id = m.id
     WHERE o.status = 'cooked' AND o.rider_id IS NULL
     ORDER BY o.created_at ASC`
  );
};

exports.getActiveCountByStore = async (conn, storeId) => {
  const [row] = await conn.query(
    `SELECT COUNT(*) as count FROM orders WHERE store_id = ? AND status NOT IN ('completed', 'cancelled')`,
    [storeId]
  );
  return row?.count || 0;
};

exports.updateStatus = async (conn, id, status) => {
  await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
};

exports.updateStatusByMeeting = async (conn, meetingId, status) => {
  await conn.query('UPDATE orders SET status = ? WHERE meeting_id = ?', [status, meetingId]);
};

exports.assignRider = async (conn, id, riderId) => {
  await conn.query(
    'UPDATE orders SET rider_id = ?, status = "delivering" WHERE id = ?',
    [riderId, id]
  );
};

exports.setDelayReason = async (conn, id, reason) => {
  await conn.query('UPDATE orders SET delay_reason = ? WHERE id = ?', [reason, id]);
};

exports.addTotalAmount = async (conn, id, amount) => {
  await conn.query('UPDATE orders SET total_amount = total_amount + ? WHERE id = ?', [amount, id]);
};

exports.subtractTotalAmount = async (conn, id, amount) => {
  await conn.query('UPDATE orders SET total_amount = total_amount - ? WHERE id = ?', [amount, id]);
};
