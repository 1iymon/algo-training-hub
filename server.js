const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT)
  ? '/tmp/data.json'
  : path.join(__dirname, 'data.json');

function defaultData() {
  return {
    admin: { email: 'admin@algogroup.us', parol: 'Algo@Admin2024', ism: 'Admin' },
    newcomerlar: [],
    pending: [],
    feedback: [],
    departamentlar: [
      { id: 1, nom: 'ELD',    rang: '#00A86B' },
      { id: 2, nom: 'Safety', rang: '#4A9EFF' },
      { id: 3, nom: 'Sales',  rang: '#FFB347' },
      { id: 4, nom: 'IT',     rang: '#C084FC' },
    ],
  };
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return defaultData();
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('saveData error:', e.message);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Login ────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { email, parol, rol } = req.body;
  if (!email || !parol) return res.json({ ok: false, xato: 'Email va parolni kiriting.' });
  const data = loadData();

  if (rol === 'admin') {
    if (email.toLowerCase() === data.admin.email.toLowerCase() && parol === data.admin.parol) {
      return res.json({ ok: true, user: { email: data.admin.email, ism: data.admin.ism, rol: 'admin' } });
    }
    return res.json({ ok: false, xato: "Noto'g'ri admin email yoki parol." });
  }

  const u = data.newcomerlar.find(
    n => n.email.toLowerCase() === email.toLowerCase() && n.parol === parol
  );
  if (!u) return res.json({ ok: false, xato: "Noto'g'ri email yoki parol." });
  if (u.holat === 'bloklangan') return res.json({ ok: false, xato: 'Akkauntingiz bloklangan.' });

  const birinchi = !!u.birinchi;
  if (birinchi) { u.birinchi = false; saveData(data); }

  return res.json({
    ok: true,
    user: { id: u.id, email: u.email, ism: u.ism, bolim: u.bolim, departamentId: u.departamentId, rol: 'newcomer' },
    birinchi,
  });
});

// ── Register ─────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { ism, familiya, email, parol, deptId } = req.body;
  const data = loadData();

  const emailBor = data.newcomerlar.some(u => u.email.toLowerCase() === email.toLowerCase())
                || data.pending.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (emailBor) return res.json({ ok: false, xato: "Bu email allaqachon ro'yxatdan o'tgan." });

  const dept = data.departamentlar.find(d => d.id === parseInt(deptId));
  data.pending.push({
    id:             Date.now(),
    ism, familiya,
    fullIsm:        ism + ' ' + familiya,
    email, parol,
    departamentId:  parseInt(deptId),
    departamentNom: dept ? dept.nom : "Noma'lum",
    sana:           new Date().toLocaleDateString('uz-UZ'),
  });
  saveData(data);
  return res.json({ ok: true, deptNom: dept ? dept.nom : '' });
});

// ── Get all data (admin panel) ────────────────────────────────
app.get('/api/data', (req, res) => {
  const data = loadData();
  res.json({
    newcomerlar:    data.newcomerlar.map(({ parol: _, ...u }) => u),
    pending:        data.pending.map(({ parol: _, ...u }) => u),
    feedback:       data.feedback,
    departamentlar: data.departamentlar,
    adminIsm:       data.admin.ism,
    adminEmail:     data.admin.email,
  });
});

// ── Admin: add newcomer directly ──────────────────────────────
app.post('/api/newcomer', (req, res) => {
  const { ism, email, parol, bolim } = req.body;
  const data = loadData();
  const emailBand = data.newcomerlar.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (emailBand) return res.json({ ok: false, xato: "Bu email allaqachon ro'yxatda bor." });
  const yangi = {
    id: Date.now(), ism, email, parol,
    bolim: bolim || 'ELD Division',
    departamentId: 1,
    holat: 'faol', progress: 0, modulTugallandi: 0, ball: null, birinchi: true,
  };
  data.newcomerlar.push(yangi);
  saveData(data);
  return res.json({ ok: true, id: yangi.id });
});

// ── Admin: delete newcomer ────────────────────────────────────
app.delete('/api/newcomer/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = loadData();
  data.newcomerlar = data.newcomerlar.filter(u => u.id !== id);
  saveData(data);
  res.json({ ok: true });
});

// ── Admin: approve pending ────────────────────────────────────
app.post('/api/pending/approve/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = loadData();
  const idx = data.pending.findIndex(u => u.id === id);
  if (idx === -1) return res.json({ ok: false });
  const u = data.pending.splice(idx, 1)[0];
  data.newcomerlar.push({
    id: Date.now(), ism: u.fullIsm, email: u.email, parol: u.parol,
    bolim: u.departamentNom || 'ELD Division',
    departamentId: u.departamentId || 1,
    holat: 'faol', progress: 0, modulTugallandi: 0, ball: null, birinchi: true,
  });
  saveData(data);
  res.json({ ok: true });
});

// ── Admin: reject pending ─────────────────────────────────────
app.delete('/api/pending/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = loadData();
  data.pending = data.pending.filter(u => u.id !== id);
  saveData(data);
  res.json({ ok: true });
});

// ── Feedback ──────────────────────────────────────────────────
app.post('/api/feedback', (req, res) => {
  const data = loadData();
  data.feedback.push({ ...req.body, id: Date.now(), sana: new Date().toLocaleDateString('uz-UZ'), oqildi: false });
  saveData(data);
  res.json({ ok: true });
});

// ── Admin credentials ─────────────────────────────────────────
app.patch('/api/admin/creds', (req, res) => {
  const { email, parol, ism } = req.body;
  const data = loadData();
  data.admin = { email, parol, ism };
  saveData(data);
  res.json({ ok: true });
});

// ── Departments ───────────────────────────────────────────────
app.post('/api/dept', (req, res) => {
  const { nom, rang } = req.body;
  const data = loadData();
  const id = Math.max(0, ...data.departamentlar.map(d => d.id)) + 1;
  data.departamentlar.push({ id, nom, rang });
  saveData(data);
  res.json({ ok: true, id });
});

app.patch('/api/dept/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { nom } = req.body;
  const data = loadData();
  const d = data.departamentlar.find(x => x.id === id);
  if (!d) return res.json({ ok: false });
  d.nom = nom;
  saveData(data);
  res.json({ ok: true });
});

app.delete('/api/dept/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = loadData();
  data.departamentlar = data.departamentlar.filter(d => d.id !== id);
  saveData(data);
  res.json({ ok: true });
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Algo Training Hub running on port ${PORT}`);
  });
}

module.exports = app;
