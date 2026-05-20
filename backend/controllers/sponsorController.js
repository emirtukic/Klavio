const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sponsors WHERE club_id=? ORDER BY type, name', [req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.create = async (req, res) => {
  const { name, logo_url, website, contact_name, contact_email, amount, type, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'Naziv sponzora je obavezan' });
  try {
    const [r] = await db.query(
      'INSERT INTO sponsors (club_id, name, logo_url, website, contact_name, contact_email, amount, type, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.club_id, name, logo_url||null, website||null, contact_name||null, contact_email||null, amount||null, type||'secondary', notes||null]
    );
    res.status(201).json({ id: r.insertId, name });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.update = async (req, res) => {
  const { name, logo_url, website, contact_name, contact_email, amount, type, active, notes } = req.body;
  try {
    await db.query(
      'UPDATE sponsors SET name=COALESCE(?,name), logo_url=COALESCE(?,logo_url), website=COALESCE(?,website), contact_name=COALESCE(?,contact_name), contact_email=COALESCE(?,contact_email), amount=COALESCE(?,amount), type=COALESCE(?,type), active=COALESCE(?,active), notes=COALESCE(?,notes) WHERE id=? AND club_id=?',
      [name||null, logo_url||null, website||null, contact_name||null, contact_email||null, amount||null, type||null, active!=null?(active?1:0):null, notes||null, req.params.id, req.user.club_id]
    );
    const [rows] = await db.query('SELECT * FROM sponsors WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM sponsors WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    res.json({ message: 'Sponzor obrisan' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
