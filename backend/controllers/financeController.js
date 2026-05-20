const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { type, year, month } = req.query;
    let where = 'f.club_id = ?';
    const params = [req.user.club_id];
    if (type) { where += ' AND f.type = ?'; params.push(type); }
    if (year)  { where += ' AND YEAR(f.date) = ?'; params.push(year); }
    if (month) { where += ' AND MONTH(f.date) = ?'; params.push(month); }
    const [rows] = await db.query(
      `SELECT f.*, u.name as created_by_name FROM finances f LEFT JOIN users u ON f.created_by = u.id WHERE ${where} ORDER BY f.date DESC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const { year } = req.query;
    const y = year || new Date().getFullYear();
    const [rows] = await db.query(
      `SELECT type, SUM(amount) as total FROM finances WHERE club_id = ? AND YEAR(date) = ? GROUP BY type`,
      [req.user.club_id, y]
    );
    const [monthly] = await db.query(
      `SELECT YEAR(date) as year, MONTH(date) as month, type, SUM(amount) as total FROM finances WHERE club_id = ? AND YEAR(date) = ? GROUP BY YEAR(date), MONTH(date), type ORDER BY month`,
      [req.user.club_id, y]
    );
    const [categories] = await db.query(
      `SELECT category, type, SUM(amount) as total FROM finances WHERE club_id = ? AND YEAR(date) = ? GROUP BY category, type ORDER BY total DESC`,
      [req.user.club_id, y]
    );
    const income = rows.find(r => r.type === 'income')?.total || 0;
    const expense = rows.find(r => r.type === 'expense')?.total || 0;
    res.json({ income: parseFloat(income), expense: parseFloat(expense), balance: parseFloat(income) - parseFloat(expense), monthly, categories });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.create = async (req, res) => {
  const { type, category, description, amount, date, reference } = req.body;
  if (!type || !category || !amount || !date) return res.status(400).json({ message: 'Tip, kategorija, iznos i datum su obavezni' });
  try {
    const [result] = await db.query(
      'INSERT INTO finances (club_id, type, category, description, amount, date, reference, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [req.user.club_id, type, category, description || null, amount, date, reference || null, req.user.id]
    );
    res.status(201).json({ id: result.insertId, type, category, amount, date });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.update = async (req, res) => {
  const { type, category, description, amount, date, reference } = req.body;
  try {
    await db.query(
      'UPDATE finances SET type=COALESCE(?,type), category=COALESCE(?,category), description=COALESCE(?,description), amount=COALESCE(?,amount), date=COALESCE(?,date), reference=COALESCE(?,reference) WHERE id=? AND club_id=?',
      [type||null, category||null, description||null, amount||null, date||null, reference||null, req.params.id, req.user.club_id]
    );
    const [rows] = await db.query('SELECT * FROM finances WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM finances WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    res.json({ message: 'Zapis obrisan' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getGoal = async (req, res) => {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS club_finance_goals (
      club_id INT PRIMARY KEY, income_goal DECIMAL(12,2) DEFAULT 0,
      expense_limit DECIMAL(12,2) DEFAULT 0, year INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    const [[row]] = await db.query('SELECT * FROM club_finance_goals WHERE club_id=?', [req.user.club_id]);
    res.json(row || { income_goal: 0, expense_limit: 0, year: new Date().getFullYear() });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.setGoal = async (req, res) => {
  const { income_goal, expense_limit, year } = req.body;
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS club_finance_goals (
      club_id INT PRIMARY KEY, income_goal DECIMAL(12,2) DEFAULT 0,
      expense_limit DECIMAL(12,2) DEFAULT 0, year INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    await db.query(
      `INSERT INTO club_finance_goals (club_id, income_goal, expense_limit, year) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE income_goal=VALUES(income_goal), expense_limit=VALUES(expense_limit), year=VALUES(year)`,
      [req.user.club_id, income_goal || 0, expense_limit || 0, year || new Date().getFullYear()]
    );
    res.json({ message: 'Ciljevi ažurirani' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
