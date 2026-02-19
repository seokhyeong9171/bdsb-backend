exports.create = async (conn, data) => {
  const { uploaderId, targetType, targetId, url } = data;
  const result = await conn.query(
    'INSERT INTO images (uploader_id, target_type, target_id, url) VALUES (?, ?, ?, ?)',
    [uploaderId, targetType, targetId, url]
  );
  return Number(result.insertId);
};

exports.findByIdAndUploader = async (conn, id, uploaderId) => {
  const [image] = await conn.query(
    'SELECT * FROM images WHERE id = ? AND uploader_id = ?',
    [id, uploaderId]
  );
  return image || null;
};

exports.findByUploader = async (conn, uploaderId, { targetType, targetId } = {}) => {
  let query = 'SELECT * FROM images WHERE uploader_id = ?';
  const params = [uploaderId];

  if (targetType) {
    query += ' AND target_type = ?';
    params.push(targetType);
  }
  if (targetId) {
    query += ' AND target_id = ?';
    params.push(targetId);
  }

  return await conn.query(query, params);
};

exports.findByTarget = async (conn, targetType, targetId) => {
  return await conn.query(
    'SELECT * FROM images WHERE target_type = ? AND target_id = ?',
    [targetType, targetId]
  );
};

exports.clearThumbnail = async (conn, targetType, targetId, uploaderId) => {
  await conn.query(
    'UPDATE images SET is_thumbnail = 0 WHERE target_type = ? AND target_id = ? AND uploader_id = ?',
    [targetType, targetId, uploaderId]
  );
};

exports.setThumbnail = async (conn, id) => {
  await conn.query('UPDATE images SET is_thumbnail = 1 WHERE id = ?', [id]);
};

exports.deleteById = async (conn, id) => {
  await conn.query('DELETE FROM images WHERE id = ?', [id]);
};
