import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import fetch from "node-fetch";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ==========================
// ROUTE TEST
// ==========================
app.get("/", (req, res) => {
  res.send("Wallet backend is running 🚀");
});

// ==========================
// INITIER RECHARGE
// ==========================
app.post("/init-deposit", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0)
      return res.status(400).json({ error: "Montant invalide" });

    const { rows } = await pool.query(
      `select initiate_deposit($1,$2) as transaction_id`,
      [userId, amount]
    );

    res.json({ success: true, transaction_id: rows[0].transaction_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ==========================
// SIMULER WEBHOOK (pour test)
// ==========================
app.post("/webhook", async (req, res) => {
  try {
    const { transaction_id, provider_transaction_id, status } = req.body;

    if (!transaction_id || !status)
      return res.status(400).json({ error: "Champs manquants" });

    await pool.query(
      `select cinetpay_webhook($1,$2,$3)`,
      [transaction_id, provider_transaction_id || "TEST", status]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur webhook" });
  }
});

// ==========================
// DEMANDER UN RETRAIT
// ==========================
app.post("/request-withdrawal", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0)
      return res.status(400).json({ error: "Montant invalide" });

    const { rows } = await pool.query(
      `select request_withdrawal($1,$2) as transaction_id`,
      [userId, amount]
    );

    res.json({ success: true, transaction_id: rows[0].transaction_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// CONFIRMER RETRAIT
// ==========================
app.post("/confirm-withdrawal", async (req, res) => {
  try {
    const { transaction_id, status } = req.body;
    if (!transaction_id || !status)
      return res.status(400).json({ error: "Champs manquants" });

    await pool.query(
      `select cinetpay_webhook($1,$2,$3)`,
      [transaction_id, "CINETPAY_PROVIDER_ID", status]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur confirmation" });
  }
});

// ==========================
// LANCER SERVEUR
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
