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

app.get("/", (req, res) => {
  res.send("🚀 Hospital Backend Running");
});

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
      password TEXT
    );

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
  `);
}
//initDB();

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

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    "INSERT INTO users(email,password) VALUES($1,$2)",
    [email, hash]
  );

  res.json({ message: "User Registered" });
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length) return res.send("User not found");

  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid) return res.send("Wrong password");

  const token = jwt.sign({ id: user.rows[0].id }, "secret");
  res.json({ token });
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

app.delete("/patients/:id", auth, async (req, res) => {
  await pool.query("DELETE FROM patients WHERE id=$1", [req.params.id]);
  res.json({ message: "Patient Deleted" });
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

// ================= BILLING =================
app.post("/billing", auth, async (req, res) => {
  const { patient_id, amount } = req.body;

  await pool.query(
    "INSERT INTO billing(patient_id,amount) VALUES($1,$2)",
    [patient_id, amount]
  );

  res.json({ message: "Bill Created" });
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

// ================= PDF REPORT =================
app.get("/report", auth, (req, res) => {
  const doc = new PDFDocument();
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(20).text("Hospital Report", { align: "center" });
  doc.text("Demo Project");

  doc.end();
});

// ================= SERVER =================
/*const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port", PORT));require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
*/
// ================= DB INIT =================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT
    );

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

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    "INSERT INTO users(email,password) VALUES($1,$2)",
    [email, hash]
  );

  res.json({ message: "User Registered" });
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length) return res.send("User not found");

  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid) return res.send("Wrong password");

  const token = jwt.sign({ id: user.rows[0].id }, "secret");
  res.json({ token });
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

app.delete("/patients/:id", auth, async (req, res) => {
  await pool.query("DELETE FROM patients WHERE id=$1", [req.params.id]);
  res.json({ message: "Patient Deleted" });
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

// ================= BILLING =================
app.post("/billing", auth, async (req, res) => {
  const { patient_id, amount } = req.body;

  await pool.query(
    "INSERT INTO billing(patient_id,amount) VALUES($1,$2)",
    [patient_id, amount]
  );

  res.json({ message: "Bill Created" });
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

// ================= PDF REPORT =================
app.get("/report", auth, (req, res) => {
  const doc = new PDFDocument();
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(20).text("Hospital Report", { align: "center" });
  doc.text("Demo Project");

  doc.end();
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port", PORT));