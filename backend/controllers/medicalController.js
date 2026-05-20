const db = require('../config/db');

exports.get = async (req, res) => {
  try {
    const memberId = req.params.memberId;
    // Members can only view own data
    if (req.user.role === 'member') {
      const [[m]] = await db.query('SELECT id FROM members WHERE user_id=?', [req.user.id]);
      if (!m || m.id != memberId) return res.status(403).json({ message: 'Nedozvoljen pristup' });
    }
    const [rows] = await db.query('SELECT * FROM member_medical WHERE member_id=?', [memberId]);
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.upsert = async (req, res) => {
  const { blood_type, allergies, current_injuries, medical_notes, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, last_medical_check } = req.body;
  const memberId = req.params.memberId;
  try {
    // Members can only edit own data
    if (req.user.role === 'member') {
      const [[m]] = await db.query('SELECT id FROM members WHERE user_id=?', [req.user.id]);
      if (!m || m.id != memberId) return res.status(403).json({ message: 'Nedozvoljen pristup' });
    }
    await db.query(`
      INSERT INTO member_medical (member_id, blood_type, allergies, current_injuries, medical_notes, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, last_medical_check)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE blood_type=VALUES(blood_type), allergies=VALUES(allergies), current_injuries=VALUES(current_injuries),
        medical_notes=VALUES(medical_notes), emergency_contact_name=VALUES(emergency_contact_name),
        emergency_contact_phone=VALUES(emergency_contact_phone), emergency_contact_relation=VALUES(emergency_contact_relation),
        last_medical_check=VALUES(last_medical_check)
    `, [memberId, blood_type||null, allergies||null, current_injuries||null, medical_notes||null, emergency_contact_name||null, emergency_contact_phone||null, emergency_contact_relation||null, last_medical_check||null]);
    const [rows] = await db.query('SELECT * FROM member_medical WHERE member_id=?', [memberId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
