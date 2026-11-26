const db = require('../config/db');
const { assertClubOwned } = require('../utils/clubScope');
const { createNotification } = require('./notificationController');
const { send: sendMail } = require('../config/mailer');
const { eventNotificationHtml } = require('../config/emailTemplates');

const MAIL_ENABLED = !!(process.env.MAIL_USER && process.env.BREVO_API_KEY);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Lets the member know a fee was added for them, or that one got marked paid -
// otherwise they'd only find out by opening Moje članarine themselves.
async function notifyFeeEvent(memberId, clubId, amount, kind, dateStr) {
  try {
    const [[m]] = await db.query(
      'SELECT u.id as user_id, u.email FROM members m JOIN users u ON m.user_id=u.id WHERE m.id=?',
      [memberId]
    );
    if (!m) return;
    const isPaid = kind === 'paid';
    const title = isPaid ? 'Članarina označena kao plaćena' : 'Nova članarina';
    const msg = isPaid
      ? `Vaša članarina od ${amount} KM je označena kao plaćena.`
      : `Dodana vam je nova članarina od ${amount} KM (rok uplate: ${dateStr}).`;
    const link = '/pages/my-fees/index.html';

    await createNotification(m.user_id, clubId, title, msg, isPaid ? 'success' : 'info', link);

    if (MAIL_ENABLED && m.email) {
      const html = eventNotificationHtml(
        title, msg,
        [['Iznos', `${amount} KM`], [isPaid ? 'Datum uplate' : 'Rok uplate', dateStr]],
        `${APP_URL}${link}`, 'Pogledaj članarinu'
      );
      try { await sendMail({ to: m.email, subject: title, html }); } catch (_) {}
    }
  } catch (err) {
    console.error('[notif] notifyFeeEvent error:', err.message);
  }
}

// A coach may only record/edit fees for members of the selection(s) they belong to.
async function memberInCoachScope(req, memberId) {
  if (req.user.role !== 'coach') return true;
  const ids = req.user.selection_ids || [];
  if (!ids.length) return false;
  const [rows] = await db.query(
    'SELECT 1 FROM member_selections WHERE member_id=? AND selection_id IN (?) LIMIT 1',
    [memberId, ids]
  );
  return rows.length > 0;
}

exports.getAll = async (req, res) => {
  try {
    // A coach only sees fees for members of the selection(s) they belong to.
    const ids = req.user.selection_ids || [];
    const coachFilter = req.user.role === 'coach'
      ? (ids.length ? ' AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=m.id AND ms.selection_id IN (?))' : ' AND 1=0')
      : '';
    const params = [req.user.club_id];
    if (req.user.role === 'coach' && ids.length) params.push(ids);
    const [rows] = await db.query(`
      SELECT mf.*, u.name as member_name, m.membership_number,
        (SELECT GROUP_CONCAT(ms.selection_id) FROM member_selections ms WHERE ms.member_id=m.id) as selection_ids,
        (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') FROM member_selections ms JOIN selections s ON s.id=ms.selection_id WHERE ms.member_id=m.id) as selection_names
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE m.club_id = ?${coachFilter}
      ORDER BY mf.due_date DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMemberFees = async (req, res) => {
  try {
    if (!(await assertClubOwned('members', req.params.memberId, req.user.club_id))) return res.status(404).json({ message: 'Član nije pronađen' });
    if (req.user.role === 'member') {
      const [[m]] = await db.query('SELECT id FROM members WHERE user_id=? AND club_id=?', [req.user.id, req.user.club_id]);
      if (!m || m.id != req.params.memberId) return res.status(403).json({ message: 'Nedozvoljen pristup' });
    }
    const [rows] = await db.query(
      'SELECT * FROM membership_fees WHERE member_id = ? ORDER BY period_start DESC',
      [req.params.memberId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { member_id, amount, period_start, period_end, due_date, payment_method, notes } = req.body;
  try {
    if (!(await assertClubOwned('members', member_id, req.user.club_id))) return res.status(404).json({ message: 'Član nije pronađen' });
    if (!(await memberInCoachScope(req, member_id))) return res.status(403).json({ message: 'Nemate pristup ovom članu' });
    const [result] = await db.query(
      'INSERT INTO membership_fees (member_id, amount, period_start, period_end, due_date, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [member_id, amount, period_start, period_end, due_date, payment_method, notes, req.user.id]
    );

    const dueStr = due_date ? new Date(due_date).toLocaleDateString('bs-BA') : '-';
    notifyFeeEvent(member_id, req.user.club_id, amount, 'created', dueStr).catch(() => {});

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

async function findOverlapping(clubId, period_start, period_end, selectionId, coachIds) {
  // coachIds is null for admin (no restriction); for a coach it's the list of
  // selections they belong to (possibly empty, meaning they see no one).
  if (coachIds && !coachIds.length) return { members: [], overlapping: [] };

  const params = [clubId];
  let sql = "SELECT id FROM members WHERE club_id = ? AND status = 'active'";
  if (selectionId) {
    sql += ' AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=members.id AND ms.selection_id=?)';
    params.push(selectionId);
  } else if (coachIds) {
    sql += ' AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=members.id AND ms.selection_id IN (?))';
    params.push(coachIds);
  }
  const [members] = await db.query(sql, params);
  if (!members.length) return { members: [], overlapping: [] };

  const [overlapping] = await db.query(
    `SELECT DISTINCT mf.member_id, u.name
     FROM membership_fees mf
     JOIN members m ON mf.member_id = m.id
     JOIN users u ON m.user_id = u.id
     WHERE mf.member_id IN (?) AND mf.period_start <= ? AND mf.period_end >= ?`,
    [members.map(m => m.id), period_end, period_start]
  );
  return { members, overlapping };
}

// A coach can only bulk-generate/preview for the selection(s) they belong to;
// an out-of-scope selection_id pick is ignored rather than rejected, falling
// back to "all of the coach's own selections".
function resolveBulkScope(req, selection_id) {
  if (req.user.role !== 'coach') return { selId: selection_id || null, coachIds: null };
  const coachIds = req.user.selection_ids || [];
  const selId = selection_id && coachIds.includes(Number(selection_id)) ? Number(selection_id) : null;
  return { selId, coachIds };
}

exports.bulkPreview = async (req, res) => {
  const { period_start, period_end, selection_id } = req.body;
  if (!period_start || !period_end) {
    return res.status(400).json({ message: 'Period je obavezan' });
  }
  try {
    const { selId, coachIds } = resolveBulkScope(req, selection_id);
    const { members, overlapping } = await findOverlapping(req.user.club_id, period_start, period_end, selId, coachIds);
    res.json({
      totalActive: members.length,
      overlapping: overlapping.map(o => ({ id: o.member_id, name: o.name })),
    });
  } catch (err) {
    console.error('Fee bulk preview error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.bulkGenerate = async (req, res) => {
  const { amount, period_start, period_end, due_date, payment_method, notes, includeOverlapIds, selection_id } = req.body;
  if (!amount || !period_start || !period_end || !due_date) {
    return res.status(400).json({ message: 'Iznos, period i rok uplate su obavezni' });
  }
  try {
    const { selId, coachIds } = resolveBulkScope(req, selection_id);
    const { members, overlapping } = await findOverlapping(req.user.club_id, period_start, period_end, selId, coachIds);
    if (!members.length) return res.json({ created: 0, skipped: 0, message: 'Nema aktivnih članova u odabranoj selekciji' });

    const includeIds = new Set(Array.isArray(includeOverlapIds) ? includeOverlapIds.map(Number) : []);
    const overlapIds = new Set(overlapping.map(o => o.member_id));
    // Create for everyone not overlapping, plus any overlapping member the admin explicitly chose to duplicate anyway.
    const toCreate = members.filter(m => !overlapIds.has(m.id) || includeIds.has(m.id));
    const skippedNames = overlapping.filter(o => !includeIds.has(o.member_id)).map(o => o.name);

    if (toCreate.length) {
      const values = toCreate.map(m => [m.id, amount, period_start, period_end, due_date, payment_method || null, notes || null, req.user.id]);
      await db.query(
        'INSERT INTO membership_fees (member_id, amount, period_start, period_end, due_date, payment_method, notes, created_by) VALUES ?',
        [values]
      );
    }

    res.status(201).json({
      created: toCreate.length,
      skipped: skippedNames.length,
      skippedNames,
    });
  } catch (err) {
    console.error('Fee bulk generate error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const { status, paid_date, payment_method, notes, amount } = req.body;
  try {
    // Fetch current state before update
    const [before] = await db.query(
      'SELECT mf.*, m.club_id, u.name as member_name FROM membership_fees mf JOIN members m ON mf.member_id = m.id JOIN users u ON m.user_id = u.id WHERE mf.id = ? AND m.club_id = ?',
      [req.params.id, req.user.club_id]
    );
    const fee = before[0];
    if (!fee) return res.status(404).json({ message: 'Članarina nije pronađena' });
    if (!(await memberInCoachScope(req, fee.member_id))) return res.status(404).json({ message: 'Članarina nije pronađena' });

    await db.query(
      `UPDATE membership_fees mf JOIN members m ON mf.member_id = m.id
       SET mf.status=COALESCE(?,mf.status), mf.paid_date=COALESCE(?,mf.paid_date), mf.payment_method=COALESCE(?,mf.payment_method), mf.notes=COALESCE(?,mf.notes), mf.amount=COALESCE(?,mf.amount)
       WHERE mf.id=? AND m.club_id=?`,
      [status, paid_date, payment_method, notes, amount, req.params.id, req.user.club_id]
    );

    // Auto-create finance income entry when marked as paid
    if (status === 'paid' && fee && fee.status !== 'paid') {
      const effectiveDate = paid_date || new Date().toISOString().slice(0, 10);
      await autoAddIncome(fee, effectiveDate, req.user.id);
      const paidStr = new Date(effectiveDate).toLocaleDateString('bs-BA');
      notifyFeeEvent(fee.member_id, fee.club_id, amount != null ? amount : fee.amount, 'paid', paidStr).catch(() => {});
    }
    // Remove the linked income entry when a fee is reverted away from paid
    // (e.g. back to pending/overdue) - it no longer represents real income.
    if (status && status !== 'paid' && fee && fee.status === 'paid') {
      await db.query(
        'DELETE FROM finances WHERE club_id=? AND reference=?',
        [fee.club_id, `CLN-${fee.id}`]
      );
    }
    // Keep the linked finance entry's amount in sync if an already-paid fee's amount is edited
    if (amount != null && fee && (fee.status === 'paid' || status === 'paid')) {
      await db.query(
        'UPDATE finances SET amount=? WHERE club_id=? AND reference=?',
        [amount, fee.club_id, `CLN-${fee.id}`]
      );
    }

    res.json({ message: 'Članarina ažurirana' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markPaid = async (req, res) => {
  const { payment_method } = req.body;
  try {
    const [before] = await db.query(
      'SELECT mf.*, m.club_id, u.name as member_name FROM membership_fees mf JOIN members m ON mf.member_id = m.id JOIN users u ON m.user_id = u.id WHERE mf.id = ? AND m.club_id = ?',
      [req.params.id, req.user.club_id]
    );
    const fee = before[0];
    if (!fee) return res.status(404).json({ message: 'Članarina nije pronađena' });
    if (!(await memberInCoachScope(req, fee.member_id))) return res.status(404).json({ message: 'Članarina nije pronađena' });

    await db.query(
      `UPDATE membership_fees mf JOIN members m ON mf.member_id = m.id
       SET mf.status='paid', mf.paid_date=CURDATE(), mf.payment_method=?
       WHERE mf.id=? AND m.club_id=?`,
      [payment_method || 'cash', req.params.id, req.user.club_id]
    );

    if (fee && fee.status !== 'paid') {
      const today = new Date().toISOString().slice(0, 10);
      await autoAddIncome(fee, today, req.user.id);
      notifyFeeEvent(fee.member_id, fee.club_id, fee.amount, 'paid', new Date(today).toLocaleDateString('bs-BA')).catch(() => {});
    }

    res.json({ message: 'Označeno kao plaćeno' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

async function autoAddIncome(fee, date, userId) {
  // Avoid duplicates - skip if a finance entry already references this fee
  const [exists] = await db.query(
    "SELECT id FROM finances WHERE club_id = ? AND reference = ? LIMIT 1",
    [fee.club_id, `CLN-${fee.id}`]
  );
  if (exists.length > 0) return;

  const periodStr = fee.period_start
    ? new Date(fee.period_start).toISOString().slice(0, 7)
    : null;
  const description = `Članarina - ${fee.member_name || 'član'}${periodStr ? ` (${periodStr})` : ''}`;

  await db.query(
    'INSERT INTO finances (club_id, type, category, description, amount, date, reference, created_by) VALUES (?,?,?,?,?,?,?,?)',
    [fee.club_id, 'income', 'Članarine', description, fee.amount, date, `CLN-${fee.id}`, userId]
  );
}

exports.remove = async (req, res) => {
  try {
    const [[fee]] = await db.query(
      'SELECT mf.member_id FROM membership_fees mf JOIN members m ON mf.member_id = m.id WHERE mf.id = ? AND m.club_id = ?',
      [req.params.id, req.user.club_id]
    );
    if (!fee) return res.status(404).json({ message: 'Članarina nije pronađena' });
    if (!(await memberInCoachScope(req, fee.member_id))) return res.status(404).json({ message: 'Članarina nije pronađena' });

    // Delete the linked income entry too, so a deleted fee doesn't keep
    // inflating the Finansije total forever.
    await db.query(
      'DELETE FROM finances WHERE club_id = ? AND reference = ?',
      [req.user.club_id, `CLN-${req.params.id}`]
    );
    await db.query(
      'DELETE mf FROM membership_fees mf JOIN members m ON mf.member_id = m.id WHERE mf.id = ? AND m.club_id = ?',
      [req.params.id, req.user.club_id]
    );
    res.json({ message: 'Članarina obrisana' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const ids = req.user.selection_ids || [];
    const coachFilter = req.user.role === 'coach'
      ? (ids.length ? ' AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=m.id AND ms.selection_id IN (?))' : ' AND 1=0')
      : '';
    const params = [req.user.club_id];
    if (req.user.role === 'coach' && ids.length) params.push(ids);
    const [stats] = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN mf.status='paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN mf.status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN mf.status='overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN mf.status='paid' THEN mf.amount ELSE 0 END) as total_collected,
        SUM(CASE WHEN mf.status!='paid' THEN mf.amount ELSE 0 END) as total_outstanding
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      WHERE m.club_id = ?${coachFilter}
    `, params);
    res.json(stats[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

function toSqlDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// If the period is exactly a calendar month, shifting it forward should land
// on the next calendar month (whatever its length) rather than a fixed day
// count - most clubs generate fees per full month.
function shiftPeriod(start, end) {
  const s = new Date(start), e = new Date(end);
  const isFullMonth = s.getDate() === 1 &&
    e.getFullYear() === new Date(s.getFullYear(), s.getMonth() + 1, 0).getFullYear() &&
    e.getMonth() === new Date(s.getFullYear(), s.getMonth() + 1, 0).getMonth() &&
    e.getDate() === new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();

  if (isFullMonth) {
    const newStart = new Date(s.getFullYear(), s.getMonth() + 1, 1);
    const newEnd = new Date(s.getFullYear(), s.getMonth() + 2, 0);
    return { start: toSqlDate(newStart), end: toSqlDate(newEnd) };
  }
  const periodDays = Math.round((e - s) / 86400000);
  const newStart = new Date(s); newStart.setDate(newStart.getDate() + periodDays + 1);
  const newEnd = new Date(e); newEnd.setDate(newEnd.getDate() + periodDays + 1);
  return { start: toSqlDate(newStart), end: toSqlDate(newEnd) };
}

exports.getLastPeriod = async (req, res) => {
  try {
    const ids = req.user.selection_ids || [];
    const coachFilter = req.user.role === 'coach'
      ? (ids.length ? ' AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=m.id AND ms.selection_id IN (?))' : ' AND 1=0')
      : '';
    const params = [req.user.club_id];
    if (req.user.role === 'coach' && ids.length) params.push(ids);
    const [[last]] = await db.query(`
      SELECT mf.period_start, mf.period_end, COUNT(*) as fee_count, COALESCE(SUM(mf.amount),0) as total_amount
      FROM membership_fees mf JOIN members m ON mf.member_id = m.id
      WHERE m.club_id = ?${coachFilter}
      GROUP BY mf.period_start, mf.period_end
      ORDER BY mf.period_end DESC
      LIMIT 1
    `, params);
    if (!last) return res.json(null);
    const next = shiftPeriod(last.period_start, last.period_end);
    res.json({
      period_start: toSqlDate(new Date(last.period_start)),
      period_end: toSqlDate(new Date(last.period_end)),
      fee_count: last.fee_count,
      total_amount: parseFloat(last.total_amount),
      next_period_start: next.start,
      next_period_end: next.end,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.duplicateLastPeriod = async (req, res) => {
  const { due_date } = req.body;
  if (!due_date) return res.status(400).json({ message: 'Rok uplate je obavezan' });
  try {
    const ids = req.user.selection_ids || [];
    const coachFilter = req.user.role === 'coach'
      ? (ids.length ? ' AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=m.id AND ms.selection_id IN (?))' : ' AND 1=0')
      : '';
    const scopeParams = [req.user.club_id];
    if (req.user.role === 'coach' && ids.length) scopeParams.push(ids);

    const [[last]] = await db.query(`
      SELECT mf.period_start, mf.period_end
      FROM membership_fees mf JOIN members m ON mf.member_id = m.id
      WHERE m.club_id = ?${coachFilter}
      GROUP BY mf.period_start, mf.period_end
      ORDER BY mf.period_end DESC
      LIMIT 1
    `, scopeParams);
    if (!last) return res.json({ created: 0, skipped: 0, message: 'Nema prethodnih članarina za dupliranje' });

    const sourceParams = [last.period_start, last.period_end, req.user.club_id];
    if (req.user.role === 'coach' && ids.length) sourceParams.push(ids);
    const [sourceFees] = await db.query(`
      SELECT mf.member_id, mf.amount, mf.notes
      FROM membership_fees mf JOIN members m ON mf.member_id = m.id
      WHERE mf.period_start=? AND mf.period_end=? AND m.club_id=?${coachFilter}
    `, sourceParams);
    if (!sourceFees.length) return res.json({ created: 0, skipped: 0, message: 'Nema članarina u prethodnom periodu' });

    const { start: newPeriodStart, end: newPeriodEnd } = shiftPeriod(last.period_start, last.period_end);

    // Don't duplicate onto a member who already has a fee overlapping the new period.
    const memberIds = sourceFees.map(f => f.member_id);
    const [existing] = await db.query(
      `SELECT DISTINCT member_id FROM membership_fees WHERE member_id IN (?) AND period_start <= ? AND period_end >= ?`,
      [memberIds, newPeriodEnd, newPeriodStart]
    );
    const existingIds = new Set(existing.map(e => e.member_id));
    const toCreate = sourceFees.filter(f => !existingIds.has(f.member_id));

    if (toCreate.length) {
      const values = toCreate.map(f => [f.member_id, f.amount, newPeriodStart, newPeriodEnd, due_date, null, f.notes, req.user.id]);
      await db.query(
        'INSERT INTO membership_fees (member_id, amount, period_start, period_end, due_date, payment_method, notes, created_by) VALUES ?',
        [values]
      );
    }
    res.status(201).json({
      created: toCreate.length,
      skipped: sourceFees.length - toCreate.length,
      period_start: newPeriodStart,
      period_end: newPeriodEnd,
    });
  } catch (err) {
    console.error('Fee duplicate error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
