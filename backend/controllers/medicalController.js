const db = require('../config/db');

// Loads the member (scoped to the caller's club) and, for the 'member' role,
// confirms it's their own record - in one query instead of two.
async function loadOwnMember(req, res, memberId) {
  const [[m]] = await db.query('SELECT id, user_id FROM members WHERE id=? AND club_id=?', [memberId, req.user.club_id]);
  if (!m) { res.status(404).json({ message: 'Član nije pronađen' }); return null; }
  if (req.user.role === 'member' && m.user_id !== req.user.id) {
    res.status(403).json({ message: 'Nedozvoljen pristup' });
    return null;
  }
  return m;
}

exports.get = async (req, res) => {
  try {
    const memberId = req.params.memberId;
    if (!(await loadOwnMember(req, res, memberId))) return;
    const [rows] = await db.query('SELECT * FROM member_medical WHERE member_id=?', [memberId]);
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.upsert = async (req, res) => {
  const { blood_type, allergies, current_injuries, medical_notes, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, last_medical_check } = req.body;
  const memberId = req.params.memberId;
  try {
    if (!(await loadOwnMember(req, res, memberId))) return;
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
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
