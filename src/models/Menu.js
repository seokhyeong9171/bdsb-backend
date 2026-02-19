exports.findByStore = async (conn, storeId) => {
  return await conn.query(
    'SELECT * FROM menus WHERE store_id = ? AND is_available = 1 ORDER BY name',
    [storeId]
  );
};

exports.findById = async (conn, id) => {
  const [menu] = await conn.query('SELECT price FROM menus WHERE id = ?', [id]);
  return menu || null;
};

exports.findWithOwner = async (conn, id) => {
  const [menu] = await conn.query(
    'SELECT m.*, s.owner_id FROM menus m JOIN stores s ON m.store_id = s.id WHERE m.id = ?',
    [id]
  );
  return menu || null;
};

exports.create = async (conn, data) => {
  const { storeId, name, price, description } = data;
  const result = await conn.query(
    'INSERT INTO menus (store_id, name, price, description) VALUES (?, ?, ?, ?)',
    [storeId, name, price, description || null]
  );
  return Number(result.insertId);
};

exports.update = async (conn, id, data) => {
  const { name, price, description } = data;
  await conn.query(
    'UPDATE menus SET name = COALESCE(?, name), price = COALESCE(?, price), description = COALESCE(?, description) WHERE id = ?',
    [name, price, description, id]
  );
};

exports.softDelete = async (conn, id) => {
  await conn.query('UPDATE menus SET is_available = 0 WHERE id = ?', [id]);
};

exports.setImage = async (conn, id, url) => {
  await conn.query('UPDATE menus SET image = ? WHERE id = ?', [url, id]);
};
