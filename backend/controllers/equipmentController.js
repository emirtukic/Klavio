const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const params = [req.user.club_id];
    let selFilter = '';
    if (req.user.role === 'coach') {
      selFilter = ' AND e.selection_id = ?';
      params.push(req.user.selection_id || 0);
    }
    const [rows] = await db.query(`
      SELECT e.*,
        u.name  AS assigned_to_name,
        s.name  AS selection_name,
        u2.name AS assigned_by_name
      FROM equipment e
      LEFT JOIN members m    ON e.assigned_to  = m.id
      LEFT JOIN users u      ON m.user_id       = u.id
      LEFT JOIN selections s ON e.selection_id  = s.id
      LEFT JOIN coaches c    ON e.assigned_by   = c.id
      LEFT JOIN users u2     ON c.user_id        = u2.id
      WHERE e.club_id = ?${selFilter}
      ORDER BY e.type, e.name
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  const { name, type, quantity, item_condition, notes, assigned_to } = req.body;
  if (!name) return res.status(400).json({ message: 'Naziv opreme je obavezan' });

  let selection_id = req.body.selection_id || null;
  let assigned_by  = req.body.assigned_by  || null;

  if (req.user.role === 'coach') {
    selection_id = req.user.selection_id || null;
    const [cRows] = await db.query(
      'SELECT id FROM coaches WHERE user_id = ? AND club_id = ?',
      [req.user.id, req.user.club_id]
    );
    assigned_by = cRows[0]?.id ?? null;
  }

  try {
    const [r] = await db.query(
      `INSERT INTO equipment
         (club_id, name, type, quantity, item_condition, notes, assigned_to, selection_id, assigned_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.user.club_id, name, type || null, quantity || 1, item_condition || 'good',
       notes || null, assigned_to || null, selection_id, assigned_by]
    );
    res.status(201).json({ id: r.insertId, name });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = async (req, res) => {
  const { name, type, quantity, assigned_to, item_condition, notes } = req.body;
  let selection_id = req.body.selection_id !== undefined ? (req.body.selection_id || null) : undefined;
  let assigned_by  = req.body.assigned_by  !== undefined ? (req.body.assigned_by  || null) : undefined;

  if (req.user.role === 'coach') {
    const [check] = await db.query(
      'SELECT id FROM equipment WHERE id = ? AND club_id = ? AND selection_id = ?',
      [req.params.id, req.user.club_id, req.user.selection_id || 0]
    );
    if (!check.length) return res.status(403).json({ message: 'Access denied' });
    selection_id = req.user.selection_id;
    const [cRows] = await db.query(
      'SELECT id FROM coaches WHERE user_id = ? AND club_id = ?',
      [req.user.id, req.user.club_id]
    );
    assigned_by = cRows[0]?.id ?? null;
  }

  try {
    const setParts = [
      'name = COALESCE(?, name)',
      'type = COALESCE(?, type)',
      'quantity = COALESCE(?, quantity)',
      'assigned_to = ?',
      'item_condition = COALESCE(?, item_condition)',
      'notes = COALESCE(?, notes)'
    ];
    const vals = [name || null, type || null, quantity || null, assigned_to || null,
                  item_condition || null, notes || null];

    if (selection_id !== undefined) { setParts.push('selection_id = ?'); vals.push(selection_id); }
    if (assigned_by  !== undefined) { setParts.push('assigned_by = ?');  vals.push(assigned_by);  }

    vals.push(req.params.id, req.user.club_id);
    await db.query(`UPDATE equipment SET ${setParts.join(', ')} WHERE id = ? AND club_id = ?`, vals);

    const [rows] = await db.query(`
      SELECT e.*, u.name AS assigned_to_name, s.name AS selection_name, u2.name AS assigned_by_name
      FROM equipment e
      LEFT JOIN members m    ON e.assigned_to  = m.id
      LEFT JOIN users u      ON m.user_id       = u.id
      LEFT JOIN selections s ON e.selection_id  = s.id
      LEFT JOIN coaches c    ON e.assigned_by   = c.id
      LEFT JOIN users u2     ON c.user_id        = u2.id
      WHERE e.id = ? AND e.club_id = ?
    `, [req.params.id, req.user.club_id]);
    if (!rows.length) return res.status(404).json({ message: 'Oprema nije pronađena' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  try {
    let query = 'DELETE FROM equipment WHERE id = ? AND club_id = ?';
    const params = [req.params.id, req.user.club_id];
    if (req.user.role === 'coach') {
      query = 'DELETE FROM equipment WHERE id = ? AND club_id = ? AND selection_id = ?';
      params.push(req.user.selection_id || 0);
    }
    await db.query(query, params);
    res.json({ message: 'Oprema obrisana' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
