require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ========== ROUTE TEST ==========
app.get('/', (req, res) => {
  res.send('Backend wallet prêt !');
});

// ========== INIT DEPOSIT ==========
app.post('/init-deposit', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ success: false, error: "Données manquantes" });

    const transaction_id = uuidv4();

    // Créer transaction dans la base (status pending)
    await supabase.from('cinetpay_transactions').insert({
      id: transaction_id,
      user_id: userId,
      amount,
      transaction_type: 'deposit',
      status: 'pending',
      created_at: new Date()
    });

    res.json({ success: true, transaction_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// ========== REQUEST WITHDRAWAL ==========
app.post('/request-withdrawal', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ success: false, error: "Données manquantes" });

    const transaction_id = uuidv4();

    // Créer transaction retrait pending
    await supabase.from('cinetpay_transactions').insert({
      id: transaction_id,
      user_id: userId,
      amount,
      transaction_type: 'withdraw',
      status: 'pending',
      created_at: new Date()
    });

    res.json({ success: true, transaction_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// ========== SIMULATE WEBHOOK ==========
app.post('/webhook', async (req, res) => {
  try {
    const { transaction_id, provider_transaction_id, status } = req.body;

    // Appel à la fonction cinetpay_webhook dans Supabase
    await supabase.rpc('cinetpay_webhook', {
      p_transaction_id: transaction_id,
      p_provider_transaction_id: provider_transaction_id,
      p_status: status
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ========== CONFIRM WITHDRAWAL ==========
app.post('/confirm-withdrawal', async (req, res) => {
  try {
    const { transaction_id, status } = req.body;
    await supabase.rpc('cinetpay_webhook', {
      p_transaction_id: transaction_id,
      p_provider_transaction_id: null,
      p_status: status
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ========== LANCER SERVEUR ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend wallet live sur port ${PORT}`));
