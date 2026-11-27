const db = require('../config/db');
const { assertClubOwned } = require('../utils/clubScope');
const { createNotification } = require('./notificationController');
const { send: sendMail } = require('../config/mailer');
const { renderEmail } = require('../config/emailTemplateStore');

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
      const key = isPaid ? 'fee_paid' : 'fee_created';
      const vars = isPaid ? { iznos: amount, datum: dateStr, __link: `${APP_URL}${link}` } : { iznos: amount, rok: dateStr, __link: `${APP_URL}${link}` };
      const rows = [['Iznos', `${amount} KM`], [isPaid ? 'Datum uplate' : 'Rok uplate', dateStr]];
      try {
        const r = await renderEmail(key, vars, rows);
        if (r.enabled) await sendMail({ to: m.email, subject: r.subject, html: r.html });
      } catch (_) {}
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
       SET mf.status='paid', mf.paid_date=CURDATE(), mf.payment_method=?, mf.paid_by=?
       WHERE mf.id=? AND m.club_id=?`,
      [payment_method || 'cash', req.user.id, req.params.id, req.user.club_id]
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

// Admin-only: per-selection AND per-coach breakdown of who has paid their
// membership fee for a given period vs. who hasn't (pending/overdue/never
// generated) - denominator is every active member of the selection, not
// just those with a fee row, so "nije platio" also surfaces members nobody
// billed yet. A coach who leads several selections gets all of them merged
// (deduped by member) into their own bucket; a selection with no coach
// assigned is grouped under a "Nema trenera" bucket in the per-coach view.
exports.getOverview = async (req, res) => {
  const { period_start, period_end } = req.query;
  try {
    let periodStart = period_start, periodEnd = period_end;
    if (!periodStart || !periodEnd) {
      const [[last]] = await db.query(`
        SELECT mf.period_start, mf.period_end
        FROM membership_fees mf JOIN members m ON mf.member_id = m.id
        WHERE m.club_id = ?
        ORDER BY mf.period_end DESC LIMIT 1
      `, [req.user.club_id]);
      if (!last) return res.json({ period_start: null, period_end: null, selections: [], coaches: [] });
      periodStart = toSqlDate(new Date(last.period_start));
      periodEnd = toSqlDate(new Date(last.period_end));
    }

    const [selRows] = await db.query(
      'SELECT id as selection_id, name as selection_name FROM selections WHERE club_id = ? ORDER BY name',
      [req.user.club_id]
    );

    const [selCoachRows] = await db.query(`
      SELECT cs.selection_id, c.id as coach_id, c.user_id as coach_user_id, cu.name as coach_name
      FROM coach_selections cs
      JOIN coaches c ON c.id = cs.coach_id
      JOIN users cu ON cu.id = c.user_id
      JOIN selections s ON s.id = cs.selection_id AND s.club_id = ?
    `, [req.user.club_id]);

    // A member can have more than one fee row inside the same period (e.g.
    // duplicated/split charges) - collapse those into one status per member
    // first, so they're never double-counted. "paid" only if every row for
    // the period is paid; "overdue" if any row is overdue; else "pending".
    // paid_by picks whichever row happens to be paid (fine for the normal
    // one-row-per-member-per-period case) so a coach's "collected" total can
    // be attributed to whoever actually marked it paid.
    const [memberRows] = await db.query(`
      SELECT ms.selection_id, m.id as member_id, u.name as member_name,
        mf.agg_status as fee_status, mf.total_amount as fee_amount, mf.due_date as fee_due_date, mf.paid_by as paid_by
      FROM member_selections ms
      JOIN members m ON m.id = ms.member_id AND m.status = 'active'
      JOIN users u ON u.id = m.user_id
      JOIN selections s ON s.id = ms.selection_id AND s.club_id = ?
      LEFT JOIN (
        SELECT member_id,
          CASE
            WHEN SUM(status != 'paid') = 0 THEN 'paid'
            WHEN SUM(status = 'overdue') > 0 THEN 'overdue'
            ELSE 'pending'
          END as agg_status,
          SUM(amount) as total_amount,
          MAX(due_date) as due_date,
          MAX(CASE WHEN status = 'paid' THEN paid_by END) as paid_by
        FROM membership_fees
        WHERE period_start = ? AND period_end = ?
        GROUP BY member_id
      ) mf ON mf.member_id = m.id
      ORDER BY u.name
    `, [req.user.club_id, periodStart, periodEnd]);

    const coachesBySelection = {};
    for (const r of selCoachRows) {
      (coachesBySelection[r.selection_id] = coachesBySelection[r.selection_id] || []).push({ coach_id: r.coach_id, coach_user_id: r.coach_user_id, coach_name: r.coach_name });
    }
    const membersBySelection = {};
    for (const m of memberRows) {
      (membersBySelection[m.selection_id] = membersBySelection[m.selection_id] || []).push({
        id: m.member_id, name: m.member_name, status: m.fee_status || 'no_fee', amount: m.fee_amount, due_date: m.fee_due_date, paid_by: m.paid_by,
      });
    }
    const sumAmount = (members, statusFilter) =>
      members.filter(m => (statusFilter ? m.status === statusFilter : true))
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    const selections = selRows.map(s => {
      const members = membersBySelection[s.selection_id] || [];
      const coachList = coachesBySelection[s.selection_id] || [];
      const paid = members.filter(m => m.status === 'paid').length;
      const collected_amount = sumAmount(members, 'paid');
      return {
        selection_id: s.selection_id,
        selection_name: s.selection_name,
        coach_names: coachList.length ? coachList.map(c => c.coach_name).join(', ') : null,
        total: members.length,
        paid,
        percent_paid: members.length ? Math.round((paid / members.length) * 100) : 0,
        collected_amount,
        owed_amount: sumAmount(members) - collected_amount,
        members,
      };
    });

    // Every coach of a selection shares its unpaid members (nobody's claimed
    // them yet) - but a paid fee only stays attributed to whichever one of
    // THIS selection's own coaches actually collected it (paid_by), so two
    // coaches sharing a selection each see only the money they personally
    // took in. A fee paid by someone who isn't one of this selection's
    // coaches (an admin, or a legacy row from before paid_by existed) falls
    // back to the old shared behaviour.
    const coachBuckets = {};
    for (const s of selRows) {
      const members = membersBySelection[s.selection_id] || [];
      const coachList = coachesBySelection[s.selection_id] || [];
      const targets = coachList.length ? coachList : [{ coach_id: 'none', coach_user_id: null, coach_name: 'Nema trenera' }];
      const coachUserIds = new Set(coachList.map(c => c.coach_user_id));
      for (const c of targets) {
        if (!coachBuckets[c.coach_id]) coachBuckets[c.coach_id] = { coach_id: c.coach_id, coach_name: c.coach_name, selectionNames: new Set(), membersMap: new Map() };
        coachBuckets[c.coach_id].selectionNames.add(s.selection_name);
        for (const m of members) {
          const claimedByAnotherCoachOfThisSelection =
            m.status === 'paid' && m.paid_by && coachUserIds.has(m.paid_by) && m.paid_by !== c.coach_user_id;
          if (claimedByAnotherCoachOfThisSelection) continue;
          coachBuckets[c.coach_id].membersMap.set(m.id, m);
        }
      }
    }
    const coaches = Object.values(coachBuckets).map(b => {
      const members = Array.from(b.membersMap.values());
      const paid = members.filter(m => m.status === 'paid').length;
      const collected_amount = sumAmount(members, 'paid');
      return {
        coach_id: b.coach_id,
        coach_name: b.coach_name,
        selection_names: Array.from(b.selectionNames).join(', '),
        total: members.length,
        paid,
        percent_paid: members.length ? Math.round((paid / members.length) * 100) : 0,
        collected_amount,
        owed_amount: sumAmount(members) - collected_amount,
        members,
      };
    }).sort((a, b) => a.coach_name.localeCompare(b.coach_name));

    res.json({ period_start: periodStart, period_end: periodEnd, selections, coaches });
  } catch (err) {
    console.error('Fee overview error:', err.message);
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
