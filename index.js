import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Supabase client avec service key pour contourner RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 🔹 Route test
app.get("/", (req, res) => {
  res.send("Wallet backend is running 🚀");
});

// 🔹 Route test des variables d'environnement
app.get("/test-env", (req, res) => {
  res.json({
    FEDA_API_KEY: process.env.FEDA_API_KEY || "undefined",
    SUPABASE_URL: process.env.SUPABASE_URL || "undefined",
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? "OK" : "undefined"
  });
});

// 🔹 Route de test dépôt minimal
app.post("/deposit", async (req, res) => {
  try {
    const { userId, amount, phone } = req.body;

    // Vérification simple
    if (!userId || !amount || !phone) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    console.log("Payload reçu :", { userId, amount, phone });

    // Simuler une création de transaction
    const fakeTransactionId = Math.floor(Math.random() * 1000000);

    // Retourner URL factice
    return res.json({
      success: true,
      payment_url: `https://sandbox.fedapay.com/fake-checkout/${fakeTransactionId}`
    });

  } catch (err) {
    console.error("Erreur /deposit :", err);
    res.status(500).json({ error: err.message });
  }
});
// 🔹 Lancer serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
