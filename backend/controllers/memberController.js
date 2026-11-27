const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const { send: sendMail } = require('../config/mailer');
const { inviteEmailHtml } = require('../config/emailTemplateStore');
const { MEMBER_LIMIT } = require('../config/planLimits');

function selScopeWhere(req, alias) {
  const a = alias ? alias + '.' : '';
  if (req.user.role === 'coach') {
    const ids = req.user.selection_ids || [];
    if (!ids.length) return { clause: ' AND 1=0', param: null };
    // A coach with one query-param pick sees just that selection (matching
    // how admins already filter); otherwise sees members of every selection
    // they belong to.
    const picked = req.query.selection_id ? Number(req.query.selection_id) : null;
    const useIds = (picked && ids.includes(picked)) ? [picked] : ids;
    return {
      clause: ` AND EXISTS (SELECT 1 FROM member_selections ms2 WHERE ms2.member_id=${a}id AND ms2.selection_id IN (?))`,
      param: useIds,
    };
  }
  // Admin picking one specific selection (e.g. building a lineup for a match)
  // means "every member of that selection", primary or additional - not just
  // whoever happens to have it as their primary.
  const selId = req.query.selection_id ? Number(req.query.selection_id) : null;
  return selId
    ? { clause: ` AND EXISTS (SELECT 1 FROM member_selections ms2 WHERE ms2.member_id=${a}id AND ms2.selection_id=?)`, param: selId }
    : { clause: '', param: null };
}

exports.getAll = async (req, res) => {
  try {
    const sel = selScopeWhere(req, 'm');
    const params = [req.user.club_id];
    if (sel.param) params.push(sel.param);
    const [rows] = await db.query(`
      SELECT m.*, u.name, u.email, u.is_active, u.email_verified,
        (SELECT GROUP_CONCAT(ms.selection_id) FROM member_selections ms WHERE ms.member_id=m.id) as selection_ids,
        (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') FROM member_selections ms JOIN selections s ON s.id=ms.selection_id WHERE ms.member_id=m.id) as selection_names
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
      SELECT m.*, u.name, u.email, u.is_active, u.email_verified,
        (SELECT GROUP_CONCAT(ms.selection_id) FROM member_selections ms WHERE ms.member_id=m.id) as selection_ids,
        (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') FROM member_selections ms JOIN selections s ON s.id=ms.selection_id WHERE ms.member_id=m.id) as selection_names
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
  const { name, email, phone, date_of_birth, address, membership_number, join_date, position, jersey_number, selection_id, selection_ids } = req.body;
  const club_id = req.user.club_id;
  // Picking several selections on the create form assigns the member to all
  // of them at once; selection_id (the first/primary one) still populates
  // the primary column exactly as before.
  const requestedSelIds = Array.isArray(selection_ids) && selection_ids.length
    ? [...new Set(selection_ids.map(Number))]
    : (selection_id ? [Number(selection_id)] : []);
  // Only ever assign selections that actually belong to this admin's own club.
  const allSelIds = requestedSelIds.length
    ? (await db.query('SELECT id FROM selections WHERE id IN (?) AND club_id = ?', [requestedSelIds, club_id]))[0].map(r => r.id)
    : [];
  if (req.user.role !== 'super_admin') {
    const limit = MEMBER_LIMIT[req.user.plan] ?? MEMBER_LIMIT.starter;
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM members WHERE club_id = ?', [club_id]);
    if (count >= limit) {
      return res.status(403).json({
        code: 'PLAN_LIMIT_REACHED',
        message: `Dostigli ste limit od ${limit} članova za vaš plan. Nadogradite plan za više članova.`
      });
    }
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const placeholder = crypto.randomBytes(32).toString('hex');
    const password_hash = await bcrypt.hash(placeholder, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [userResult] = await conn.query(
      "INSERT INTO users (name, email, password_hash, role, club_id, email_verified, verification_token, verification_expires, token_purpose) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'invite')",
      [name, email, password_hash, 'member', club_id, token, expires]
    );
    const [memberResult] = await conn.query(
      'INSERT INTO members (user_id, membership_number, phone, date_of_birth, address, join_date, club_id, position, jersey_number, selection_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userResult.insertId, membership_number, phone, date_of_birth, address, join_date || new Date().toISOString().split('T')[0], club_id, position||null, jersey_number||null, allSelIds[0] || null]
    );
    if (allSelIds.length) {
      const values = allSelIds.map(id => [memberResult.insertId, id]);
      await conn.query('INSERT IGNORE INTO member_selections (member_id, selection_id) VALUES ?', [values]);
    }
    await conn.commit();

    // Send welcome email (non-blocking)
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/app/set-password.html?token=${token}`;
    const [clubRows] = await db.query('SELECT name FROM clubs WHERE id = ?', [club_id]);
    const clubName = clubRows[0]?.name || 'Klavio';
    inviteEmailHtml(name, 'member', clubName, link).then(html => sendMail({
      to: email,
      subject: `Dobrodošli u ${clubName} - Aktivirajte nalog`,
      text: `Pozdrav ${name},\n\nAdministrator kluba "${clubName}" je kreirao vaš članski nalog na Klavio platformi.\n\nKliknite na link ispod da postavite lozinku i aktivirate nalog:\n\n${link}\n\nLink je valjan 7 dana.\n\n© 2026 Klavio`,
      html,
    })).catch(err => console.error('Welcome mail error:', err.message));

    res.status(201).json({ id: memberResult.insertId, user_id: userResult.insertId, name, email });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email ili broj članske već postoji' });
    console.error('Member create error:', err.message);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.update = async (req, res) => {
  const { name, email, phone, date_of_birth, address, status, is_active, position, jersey_number, selection_id, membership_number, join_date } = req.body;
  // A coach never reassigns which selection a member belongs to - only admins
  // send selection_id, so its key is simply absent from a coach's request.
  // Distinguish "key absent" (leave untouched) from "key present" (set/clear)
  // instead of collapsing both to null, which used to wipe the selection on
  // every edit that didn't happen to include it.
  const hasSelectionField = Object.prototype.hasOwnProperty.call(req.body, 'selection_id');
  let safeSelId = null;
  if (hasSelectionField && selection_id) {
    // Only ever assign a selection that actually belongs to this admin's own club.
    const [sels] = await db.query('SELECT id FROM selections WHERE id = ? AND club_id = ?', [selection_id, req.user.club_id]);
    if (sels.length) safeSelId = sels[0].id;
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [members] = await conn.query('SELECT user_id FROM members WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!members.length) { await conn.rollback(); return res.status(404).json({ message: 'Član nije pronađen' }); }

    // A coach may only edit members of the selection(s) they belong to.
    if (req.user.role === 'coach') {
      const ids = req.user.selection_ids || [];
      const [inScope] = ids.length
        ? await conn.query('SELECT 1 FROM member_selections WHERE member_id=? AND selection_id IN (?) LIMIT 1', [req.params.id, ids])
        : [[]];
      if (!inScope.length) { await conn.rollback(); return res.status(404).json({ message: 'Član nije pronađen' }); }
    }

    await conn.query(
      'UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), is_active=COALESCE(?,is_active) WHERE id=?',
      [name, email, is_active, members[0].user_id]
    );
    const setSelection = hasSelectionField ? ', selection_id=?' : '';
    const updateParams = [phone, date_of_birth, address, status, position||null, jersey_number||null, membership_number||null, join_date||null];
    if (hasSelectionField) updateParams.push(safeSelId);
    updateParams.push(req.params.id);
    await conn.query(
      `UPDATE members SET phone=COALESCE(?,phone), date_of_birth=COALESCE(?,date_of_birth), address=COALESCE(?,address), status=COALESCE(?,status), position=COALESCE(?,position), jersey_number=COALESCE(?,jersey_number), membership_number=COALESCE(?,membership_number), join_date=COALESCE(?,join_date)${setSelection} WHERE id=?`,
      updateParams
    );
    // Setting a primary selection always ensures membership in it too; it
    // never removes any other (additional) selections assigned elsewhere.
    if (safeSelId) {
      await conn.query('INSERT IGNORE INTO member_selections (member_id, selection_id) VALUES (?, ?)', [req.params.id, safeSelId]);
    }
    await conn.commit();
    res.json({ message: 'Član ažuriran' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'E-mail ili broj članske karte već postoji' });
    }
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
      // Only ever assign a selection that actually belongs to this admin's own club.
      let safeValue = null;
      if (value) {
        const [sels] = await db.query('SELECT id FROM selections WHERE id = ? AND club_id = ?', [value, req.user.club_id]);
        if (sels.length) safeValue = sels[0].id;
      }
      await db.query(
        `UPDATE members SET selection_id = ? WHERE id IN (${placeholders}) AND club_id = ?`,
        [safeValue, ...ids, req.user.club_id]
      );
      if (safeValue) {
        await db.query(
          `INSERT IGNORE INTO member_selections (member_id, selection_id) SELECT id, ? FROM members WHERE id IN (${placeholders}) AND club_id = ?`,
          [safeValue, ...ids, req.user.club_id]
        );
      }
    } else if (action === 'delete') {
      const [members] = await db.query(
        `SELECT id, user_id FROM members WHERE id IN (${placeholders}) AND club_id = ?`,
        [...ids, req.user.club_id]
      );
      const memberIds = members.map(m => m.id);
      const userIds = members.map(m => m.user_id);
      if (memberIds.length) {
        // Same tagging as the single-member delete, before the cascade removes the fees.
        await db.query(
          `UPDATE finances f
           JOIN membership_fees mf ON f.reference = CONCAT('CLN-', mf.id)
           SET f.description = CONCAT(f.description, ' [Član izbrisan]')
           WHERE mf.member_id IN (${memberIds.map(()=>'?').join(',')}) AND f.club_id = ? AND f.description NOT LIKE '%[Član izbrisan]%'`,
          [...memberIds, req.user.club_id]
        );
      }
      if (userIds.length) {
        await db.query(`DELETE FROM users WHERE id IN (${userIds.map(()=>'?').join(',')})`, userIds);
      }
    } else {
      return res.status(400).json({ message: 'Nepoznata akcija' });
    }
    res.json({ message: 'Akcija izvršena', count: ids.length });
  } catch (err) {
    console.error('bulkAction error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [members] = await db.query('SELECT user_id FROM members WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!members.length) return res.status(404).json({ message: 'Član nije pronađen' });
    // Tag any finance income entries tied to this member's fees before the
    // cascade deletes the fees themselves, so the paid history stays readable.
    await db.query(
      `UPDATE finances f
       JOIN membership_fees mf ON f.reference = CONCAT('CLN-', mf.id)
       SET f.description = CONCAT(f.description, ' [Član izbrisan]')
       WHERE mf.member_id = ? AND f.club_id = ? AND f.description NOT LIKE '%[Član izbrisan]%'`,
      [req.params.id, req.user.club_id]
    );
    await db.query('DELETE FROM users WHERE id = ?', [members[0].user_id]);
    res.json({ message: 'Član obrisan' });
  } catch (err) {
    console.error('Member remove error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.*, u.name, u.email,
        (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') FROM member_selections ms JOIN selections s ON s.id=ms.selection_id WHERE ms.member_id=m.id) as selection_names
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
