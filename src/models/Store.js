exports.create = async (conn, data) => {
  const { ownerId, name, description, category, phone, address, openTime, closeTime, closedDays, deliveryFee, minOrderAmount } = data;
  const result = await conn.query(
    `INSERT INTO stores (owner_id, name, description, category, phone, address, open_time, close_time, closed_days, delivery_fee, min_order_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ownerId, name, description || null, category || 'etc', phone || null, address,
     openTime || null, closeTime || null, closedDays || null, deliveryFee || 0, minOrderAmount || 0]
  );
  return Number(result.insertId);
};

exports.findById = async (conn, id) => {
  const [store] = await conn.query('SELECT * FROM stores WHERE id = ? AND is_active = 1', [id]);
  return store || null;
};

exports.findOwnerById = async (conn, id) => {
  const [store] = await conn.query('SELECT owner_id FROM stores WHERE id = ?', [id]);
  return store || null;
};

exports.findByOwner = async (conn, ownerId) => {
  return await conn.query(
    'SELECT * FROM stores WHERE owner_id = ? AND is_active = 1 ORDER BY created_at DESC',
    [ownerId]
  );
};

exports.search = async (conn, { category, search, limit, offset }) => {
  let query = 'SELECT * FROM stores WHERE is_active = 1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY name LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await conn.query(query, params);
};

exports.update = async (conn, id, data) => {
  const { name, description, category, phone, address, openTime, closeTime, closedDays, deliveryFee, minOrderAmount } = data;
  await conn.query(
    `UPDATE stores SET name = COALESCE(?, name), description = COALESCE(?, description),
     category = COALESCE(?, category), phone = COALESCE(?, phone), address = COALESCE(?, address),
     open_time = COALESCE(?, open_time), close_time = COALESCE(?, close_time),
     closed_days = COALESCE(?, closed_days), delivery_fee = COALESCE(?, delivery_fee),
     min_order_amount = COALESCE(?, min_order_amount)
     WHERE id = ?`,
    [name, description, category, phone, address, openTime, closeTime, closedDays, deliveryFee, minOrderAmount, id]
  );
};

exports.softDelete = async (conn, id) => {
  await conn.query('UPDATE stores SET is_active = 0 WHERE id = ?', [id]);
};

exports.setThumbnail = async (conn, id, url) => {
  await conn.query('UPDATE stores SET thumbnail = ? WHERE id = ?', [url, id]);
};
