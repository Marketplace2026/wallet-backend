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

// =============================
// 🔥 ROUTE DEPOSIT
// =============================
app.post("/deposit", async (req, res) => {
  try {
    const { userId, amount, phone } = req.body;
    console.log("POST /deposit reçu :", req.body);

    // 🔹 Vérification des champs
    if (!userId || !amount || !phone) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    // 🔹 Créer transaction pending dans Supabase
    const { data: walletData, error: walletError } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: userId,
        amount: amount,
        transaction_type: "deposit",
        status: "pending",
        description: `Recharge portefeuille ID utilisateur ${userId}`,
        phone: phone
      })
      .select()
      .single();

    if (walletError) {
      console.error("Erreur insertion Supabase:", walletError);
      return res.status(500).json({ error: walletError.message, details: walletError.details });
    }

    console.log("Transaction créée:", walletData);

    const transactionId = walletData.id;

    // 🔹 Créer transaction FedaPay sandbox
    const response = await fetch("https://api-sandbox.fedapay.com/v1/transactions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FEDA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        description: `Recharge Wallet ID ${transactionId}`,
        amount: amount,
        currency: { iso: "XOF" },
        customer: {
          firstname: "Client",
          lastname: "Wallet",
          phone_number: phone,
          email: "client@email.com"
        },
        redirect_url: "https://ton-frontend.com/deposit-success"
      })
    });

    const fedapayResult = await response.json();
    console.log("Réponse FedaPay :", fedapayResult);

    if (!fedapayResult || !fedapayResult.id || !fedapayResult.url) {
      return res.status(400).json({ error: "Erreur création transaction FedaPay", fedapayResult });
    }

    // 🔹 Retour frontend
    res.json({
      success: true,
      payment_url: fedapayResult.url,
      transactionId
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
