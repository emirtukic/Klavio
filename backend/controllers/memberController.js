const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const { send: sendMail } = require('../config/mailer');
const { inviteEmailHtml } = require('../config/emailTemplates');

function selScopeWhere(req, alias) {
  const a = alias ? alias + '.' : '';
  const selId = (req.user.role === 'coach' && req.user.selection_id)
    ? req.user.selection_id
    : (req.query.selection_id || null);
  return selId ? { clause: ` AND ${a}selection_id = ?`, param: selId } : { clause: '', param: null };
}

exports.getAll = async (req, res) => {
  try {
    const sel = selScopeWhere(req, 'm');
    const params = [req.user.club_id];
    if (sel.param) params.push(sel.param);
    const [rows] = await db.query(`
      SELECT m.*, u.name, u.email, u.is_active
      FROM members m JOIN users u ON m.user_id = u.id
      WHERE m.club_id = ?${sel.clause}
      ORDER BY u.name
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.*, u.name, u.email, u.is_active
      FROM members m JOIN users u ON m.user_id = u.id
      WHERE m.id = ? AND m.club_id = ?
    `, [req.params.id, req.user.club_id]);
    if (!rows.length) return res.status(404).json({ message: 'Član nije pronađen' });

    const [fees] = await db.query(
      'SELECT * FROM membership_fees WHERE member_id = ? ORDER BY period_start DESC',
      [req.params.id]
    );
    res.json({ ...rows[0], fees });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { name, email, phone, date_of_birth, address, membership_number, join_date, position, jersey_number, selection_id } = req.body;
  const club_id = req.user.club_id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const placeholder = crypto.randomBytes(32).toString('hex');
    const password_hash = await bcrypt.hash(placeholder, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, club_id, email_verified, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      [name, email, password_hash, 'member', club_id, token, expires]
    );
    const [memberResult] = await conn.query(
      'INSERT INTO members (user_id, membership_number, phone, date_of_birth, address, join_date, club_id, position, jersey_number, selection_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userResult.insertId, membership_number, phone, date_of_birth, address, join_date || new Date().toISOString().split('T')[0], club_id, position||null, jersey_number||null, selection_id||null]
    );
    await conn.commit();

    // Send welcome email (non-blocking)
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/set-password.html?token=${token}`;
    const [clubRows] = await db.query('SELECT name FROM clubs WHERE id = ?', [club_id]);
    const clubName = clubRows[0]?.name || 'Klavio';
    sendMail({
      to: email,
      subject: `Dobrodošli u ${clubName} - Aktivirajte nalog`,
      text: `Pozdrav ${name},\n\nAdministrator kluba "${clubName}" je kreirao vaš članski nalog na Klavio platformi.\n\nKliknite na link ispod da postavite lozinku i aktivirate nalog:\n\n${link}\n\nLink je valjan 7 dana.\n\n© 2026 Klavio · klavio.app`,
      html: inviteEmailHtml(name, 'member', clubName, link),
    }).catch(err => console.error('Welcome mail error:', err.message));

    res.status(201).json({ id: memberResult.insertId, user_id: userResult.insertId, name, email });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email ili broj članske već postoji' });
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.update = async (req, res) => {
  const { name, email, phone, date_of_birth, address, status, is_active, position, jersey_number, selection_id } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [members] = await conn.query('SELECT user_id FROM members WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!members.length) { await conn.rollback(); return res.status(404).json({ message: 'Član nije pronađen' }); }

    await conn.query(
      'UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), is_active=COALESCE(?,is_active) WHERE id=?',
      [name, email, is_active, members[0].user_id]
    );
    await conn.query(
      'UPDATE members SET phone=COALESCE(?,phone), date_of_birth=COALESCE(?,date_of_birth), address=COALESCE(?,address), status=COALESCE(?,status), position=COALESCE(?,position), jersey_number=COALESCE(?,jersey_number), selection_id=? WHERE id=?',
      [phone, date_of_birth, address, status, position||null, jersey_number||null, selection_id||null, req.params.id]
    );
    await conn.commit();
    res.json({ message: 'Član ažuriran' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.bulkAction = async (req, res) => {
  const { ids, action, value } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: 'Nema odabranih članova' });
  const placeholders = ids.map(() => '?').join(',');
  try {
    if (action === 'status') {
      if (!['active','inactive','suspended'].includes(value)) return res.status(400).json({ message: 'Nevalidan status' });
      await db.query(
        `UPDATE members SET status = ? WHERE id IN (${placeholders}) AND club_id = ?`,
        [value, ...ids, req.user.club_id]
      );
    } else if (action === 'selection') {
      await db.query(
        `UPDATE members SET selection_id = ? WHERE id IN (${placeholders}) AND club_id = ?`,
        [value || null, ...ids, req.user.club_id]
      );
    } else if (action === 'delete') {
      const [members] = await db.query(
        `SELECT user_id FROM members WHERE id IN (${placeholders}) AND club_id = ?`,
        [...ids, req.user.club_id]
      );
      const userIds = members.map(m => m.user_id);
      if (userIds.length) {
        await db.query(`DELETE FROM users WHERE id IN (${userIds.map(()=>'?').join(',')})`, userIds);
      }
    } else {
      return res.status(400).json({ message: 'Nepoznata akcija' });
    }
    res.json({ message: 'Akcija izvršena', count: ids.length });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  try {
    const [members] = await db.query('SELECT user_id FROM members WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!members.length) return res.status(404).json({ message: 'Član nije pronađen' });
    await db.query('DELETE FROM users WHERE id = ?', [members[0].user_id]);
    res.json({ message: 'Član obrisan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.*, u.name, u.email
      FROM members m JOIN users u ON m.user_id = u.id
      WHERE u.id = ?
    `, [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'Profil nije pronađen' });

    const [fees] = await db.query(
      'SELECT * FROM membership_fees WHERE member_id = ? ORDER BY period_start DESC',
      [rows[0].id]
    );
    res.json({ ...rows[0], fees });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
