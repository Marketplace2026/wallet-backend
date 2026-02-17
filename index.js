import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.get("/", (req, res) => {
  res.send("Wallet backend is running 🚀");
});

app.get("/users", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("*");

  if (error) return res.status(400).json(error);

  res.json(data);
});


// =============================
// 🔥 ROUTE DEPOSIT ICI
// =============================
app.post("/deposit", async (req, res) => {
  try {
    const { userId, amount, phone } = req.body;

    if (!userId || !amount || !phone) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    // 1️⃣ Créer transaction pending
    const { data, error } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: userId,
        amount: amount,
        type: "deposit",
        status: "pending"
      })
      .select()
      .single();

    if (error) throw error;

    const transactionId = data.id;

    // 2️⃣ Créer transaction FedaPay (SANDBOX)
    const response = await fetch(
      "https://api-sandbox.fedapay.com/v1/transactions",
      {
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
          }
        })
      }
    );

    const result = await response.json();

    if (!result || !result.id) {
      return res.status(400).json({ error: "Erreur FedaPay" });
    }

    return res.json({
      success: true,
      payment_url: result.url
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
