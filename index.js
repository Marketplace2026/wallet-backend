import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 🔹 Test route
app.get("/", (req, res) => res.send("Wallet backend is running 🚀"));

// 🔹 Deposit route
app.post("/deposit", async (req, res) => {
  try {
    const { userId, amount, phone } = req.body;

    // ✅ Vérification des champs
    if (!userId || !amount || !phone) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    // 1️⃣ Créer transaction pending dans Supabase
    const { data, error } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: userId,
        amount,
        transaction_type: "deposit",
        status: "pending",
        description: `Recharge portefeuille ID ${userId}`,
        phone
      })
      .select()
      .single();

    if (error) throw error;

    const transactionId = data.id;

    // 2️⃣ Appel FedaPay sandbox
    try {
      const response = await fetch("https://api-sandbox.fedapay.com/v1/transactions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FEDA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          description: `Recharge Wallet ID ${transactionId}`,
          amount,
          currency: { iso: "XOF" },
          customer: {
            firstname: "Client",
            lastname: "Wallet",
            phone_number: phone,
            email: "client@email.com"
          },
          redirect_url: "https://ton-frontend.com/test-success.html"
        })
      });

      const result = await response.json();
      console.log("FedaPay response:", result);

      if (!result || !result.url) {
        // 🔴 Mettre la transaction en failed
        await supabase
          .from("wallet_transactions")
          .update({ status: "failed" })
          .eq("id", transactionId);

        return res.status(400).json({ error: "Erreur création transaction FedaPay" });
      }

      // ✅ Retour frontend avec lien paiement
      return res.json({ success: true, payment_url: result.url });

    } catch (err) {
      // 🔴 En cas d'erreur fetch, marquer failed
      await supabase
        .from("wallet_transactions")
        .update({ status: "failed" })
        .eq("id", transactionId);

      console.error("Erreur fetch FedaPay :", err);
      return res.status(500).json({ error: "Erreur serveur FedaPay" });
    }

  } catch (err) {
    console.error("Erreur /deposit :", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Lancer serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
