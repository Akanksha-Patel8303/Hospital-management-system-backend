require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json());

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("🚀 Hospital Backend Running");
});

// ================= DATABASE =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================= DB INIT =================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'patient'
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'patient';

    CREATE TABLE IF NOT EXISTS patients(
      id SERIAL PRIMARY KEY,
      name TEXT,
      age INT,
      disease TEXT
    );

    CREATE TABLE IF NOT EXISTS doctors(
      id SERIAL PRIMARY KEY,
      name TEXT,
      specialization TEXT,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS appointments(
      id SERIAL PRIMARY KEY,
      patient_id INT,
      doctor_id INT,
      date DATE
    );

    CREATE TABLE IF NOT EXISTS medicines(
      id SERIAL PRIMARY KEY,
      name TEXT,
      price INT,
      stock INT
    );

    CREATE TABLE IF NOT EXISTS billing(
      id SERIAL PRIMARY KEY,
      patient_id INT,
      amount INT
    );

    CREATE TABLE IF NOT EXISTS slips(
      id SERIAL PRIMARY KEY,
      patient_name TEXT,
      age INT,
      disease TEXT,
      doctor TEXT,
      token INT,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );


  `);
}
initDB();

// ================= AUTH =================
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, "secret", (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ================= SIGNUP =================
app.post("/signup", async (req, res) => {
  const { email, password, role } = req.body;

  const hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users(email,password,role) VALUES($1,$2,$3)",
      [email, hash, role || "patient"] // default patient
    );

    res.json({ message: "Signup success" });
  } catch {
    res.status(400).json({ message: "User already exists" });
  }
});
// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length) {
    return res.json({ message: "User not found" });
  }

  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid) {
    return res.json({ message: "Wrong password" });
  }

  const token = jwt.sign(
    { id: user.rows[0].id, role: user.rows[0].role },
    "secret"
  );

  res.json({
    token,
    role: user.rows[0].role   // 👈 VERY IMPORTANT
  });
});
// ================= DASHBOARD =================
app.get("/dashboard", auth, async (req, res) => {
  const p = await pool.query("SELECT COUNT(*) FROM patients");
  const d = await pool.query("SELECT COUNT(*) FROM doctors");
  const a = await pool.query("SELECT COUNT(*) FROM appointments");

  res.json({
    patients: p.rows[0].count,
    doctors: d.rows[0].count,
    appointments: a.rows[0].count
  });
});

// ================= PATIENT =================
app.get("/patients", auth, async (req, res) => {
  const data = await pool.query("SELECT * FROM patients");
  res.json(data.rows);
});

app.post("/patients", auth, async (req, res) => {
  const { name, age, disease } = req.body;

  await pool.query(
    "INSERT INTO patients(name,age,disease) VALUES($1,$2,$3)",
    [name, age, disease]
  );

  res.json({ message: "Patient Added" });
});

// ================= DOCTOR =================
app.get("/doctors", auth, async (req, res) => {
  const data = await pool.query("SELECT * FROM doctors");
  res.json(data.rows);
});

app.post("/doctors", auth, async (req, res) => {
  const { name, specialization, email } = req.body;

  await pool.query(
    "INSERT INTO doctors(name,specialization,email) VALUES($1,$2,$3)",
    [name, specialization, email]
  );

  res.json({ message: "Doctor Added" });
});

// ================= APPOINTMENT =================
app.get("/appointments", auth, async (req, res) => {
  const data = await pool.query(`
    SELECT a.id, p.name AS patient, d.name AS doctor, a.date
    FROM appointments a
    JOIN patients p ON p.id=a.patient_id
    JOIN doctors d ON d.id=a.doctor_id
  `);
  res.json(data.rows);
});

app.post("/appointments", auth, async (req, res) => {
  const { patient_id, doctor_id, date } = req.body;

  await pool.query(
    "INSERT INTO appointments(patient_id,doctor_id,date) VALUES($1,$2,$3)",
    [patient_id, doctor_id, date]
  );

  res.json({ message: "Appointment Booked" });
});

// ================= PHARMACY =================
app.get("/medicines", auth, async (req, res) => {
  const data = await pool.query("SELECT * FROM medicines");
  res.json(data.rows);
});

app.post("/medicines", auth, async (req, res) => {
  const { name, price, stock } = req.body;

  await pool.query(
    "INSERT INTO medicines(name,price,stock) VALUES($1,$2,$3)",
    [name, price, stock]
  );

  res.json({ message: "Medicine Added" });
});

// ================= BILLING =================
app.post("/billing", auth, async (req, res) => {
  const { patient_id, amount } = req.body;

  await pool.query(
    "INSERT INTO billing(patient_id,amount) VALUES($1,$2)",
    [patient_id, amount]
  );

  res.json({ message: "Bill Created" });
});

// ================= SLIP + TOKEN =================
app.post("/slip", async (req, res) => {
  const { patient_name, age, disease, doctor } = req.body;

  const last = await pool.query(
    "SELECT token FROM slips ORDER BY id DESC LIMIT 1"
  );

  let token = 1;
  if (last.rows.length > 0) {
    token = last.rows[0].token + 1;
  }

  await pool.query(
    "INSERT INTO slips(patient_name,age,disease,doctor,token) VALUES($1,$2,$3,$4,$5)",
    [patient_name, age, disease, doctor, token]
  );

  res.json({ message: "Slip Created", token });
});

// ================= GET SLIPS =================
app.get("/slips", async (req, res) => {
  const data = await pool.query("SELECT * FROM slips ORDER BY id DESC");
  res.json(data.rows);
});

// ================= PDF REPORT =================
app.get("/report", auth, (req, res) => {
  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");

  doc.pipe(res);

  doc.fontSize(20).text("Hospital Slip", { align: "center" });
  doc.text("Generated Report");

  doc.end();
});

// ================= SERVER =================
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log("Server running on port", PORT));