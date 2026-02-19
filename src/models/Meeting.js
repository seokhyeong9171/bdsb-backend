exports.create = async (conn, data) => {
  const {
    leaderId, storeId, title, diningType, orderType, pickupLocation, meetingLocation,
    minMembers, maxMembers, deliveryFee, allowEarlyOrder, deadline, description, campus
  } = data;
  const result = await conn.query(
    `INSERT INTO meetings (leader_id, store_id, title, dining_type, order_type,
     pickup_location, meeting_location, min_members, max_members, delivery_fee,
     allow_early_order, deadline, description, campus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [leaderId, storeId, title, diningType || 'individual', orderType || 'instant',
     pickupLocation, meetingLocation || null, minMembers || 2, maxMembers || 4,
     deliveryFee || 0, allowEarlyOrder ? 1 : 0, deadline, description || null, campus || null]
  );
  return Number(result.insertId);
};

exports.findByIdWithCount = async (conn, id) => {
  const [meeting] = await conn.query(
    `SELECT m.*, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members
     FROM meetings m WHERE m.id = ?`,
    [id]
  );
  return meeting || null;
};

exports.findByIdWithDetails = async (conn, id) => {
  const [meeting] = await conn.query(
    `SELECT m.*, s.name as store_name, s.category as store_category, s.min_order_amount,
            u.nickname as leader_nickname
     FROM meetings m
     JOIN stores s ON m.store_id = s.id
     JOIN users u ON m.leader_id = u.id
     WHERE m.id = ?`,
    [id]
  );
  return meeting || null;
};

exports.findByIdWithCountAndMinOrder = async (conn, id) => {
  const [meeting] = await conn.query(
    `SELECT m.*, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members,
            s.min_order_amount
     FROM meetings m JOIN stores s ON m.store_id = s.id WHERE m.id = ?`,
    [id]
  );
  return meeting || null;
};

exports.search = async (conn, { campus, category, sort, limit, offset }) => {
  let query = `
    SELECT m.*, s.name as store_name, s.category as store_category, s.thumbnail as store_thumbnail,
      (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members,
      u.nickname as leader_nickname
    FROM meetings m
    JOIN stores s ON m.store_id = s.id
    JOIN users u ON m.leader_id = u.id
    WHERE m.status = 'recruiting' AND m.deadline > NOW()
  `;
  const params = [];

  if (campus) {
    query += ' AND m.campus = ?';
    params.push(campus);
  }
  if (category) {
    query += ' AND s.category = ?';
    params.push(category);
  }

  query += sort === 'deadline' ? ' ORDER BY m.deadline ASC' : ' ORDER BY m.created_at DESC';
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await conn.query(query, params);
};

exports.updateStatus = async (conn, id, status) => {
  await conn.query('UPDATE meetings SET status = ? WHERE id = ?', [status, id]);
};

exports.findStatus = async (conn, id) => {
  const [meeting] = await conn.query('SELECT status FROM meetings WHERE id = ?', [id]);
  return meeting || null;
};
