require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// =====================
// 🔹 Init Deposit
// =====================
app.post('/init-deposit', async (req, res) => {
  try {
    const { userId, amount, operator, phone } = req.body;
    if (!userId || !amount || !operator || !phone) {
      return res.status(400).json({ success: false, error: "Données manquantes" });
    }

    const transaction_id = uuidv4();

    // Créer transaction pending dans ta table cinetpay_transactions
    const { error } = await supabase
      .from('cinetpay_transactions')
      .insert({
        id: transaction_id,
        user_id: userId,
        amount,
        operator,
        phone,
        transaction_type: 'deposit',
        status: 'pending',
        created_at: new Date()
      });

    if (error) throw error;

    // Appel CinetPay API pour créer la transaction
    const response = await axios.post('https://api.cinetpay.com/v1/payment', {
      amount,
      currency: 'XOF',
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id,
      description: 'Recharge wallet',
      customer_phone: phone,
      notify_url: 'https://ton-serveur.com/webhook',
      payment_method: operator
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.CINETPAY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Retourner l'URL de paiement
    return res.json({
      success: true,
      transaction_id,
      payment_url: response.data.payment_url
    });

  } catch (err) {
    console.error("Erreur init-deposit:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: "Erreur serveur init-deposit" });
  }
});

// =====================
// 🔹 Request Withdrawal
// =====================
app.post('/request-withdrawal', async (req, res) => {
  try {
    const { userId, amount, operator, phone } = req.body;
    if (!userId || !amount || !operator || !phone) {
      return res.status(400).json({ success: false, error: "Données manquantes" });
    }

    const transaction_id = uuidv4();

    // Vérifier solde
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single();
    if (userError || !userData) throw new Error("Utilisateur introuvable");

    if (userData.wallet_balance < amount) {
      return res.status(400).json({ success: false, error: "Solde insuffisant" });
    }

    // Débiter solde immédiatement (ou tu peux le débiter lors de confirmation)
    await supabase
      .from('profiles')
      .update({ wallet_balance: userData.wallet_balance - amount })
      .eq('id', userId);

    // Créer transaction pending
    const { error } = await supabase
      .from('cinetpay_transactions')
      .insert({
        id: transaction_id,
        user_id: userId,
        amount,
        operator,
        phone,
        transaction_type: 'withdraw',
        status: 'pending',
        created_at: new Date()
      });
    if (error) throw error;

    // Ici tu peux appeler API CinetPay pour payer le Mobile Money
    // ... à faire quand tu auras la clé live

    return res.json({
      success: true,
      transaction_id,
      message: "Retrait initié, sera confirmé après paiement"
    });

  } catch (err) {
    console.error("Erreur request-withdrawal:", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur retrait" });
  }
});

// =====================
// 🔹 Webhook CinetPay
// =====================
app.post('/webhook', async (req, res) => {
  try {
    const { transaction_id, provider_transaction_id, status, secret } = req.body;

    // Vérifier secret
    if (secret !== process.env.CINETPAY_WEBHOOK_SECRET) {
      return res.status(403).send("Unauthorized");
    }

    // Récupérer transaction
    const { data: trx, error: trxError } = await supabase
      .from('cinetpay_transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();
    if (trxError || !trx) return res.status(404).send("Transaction introuvable");

    if (trx.status !== 'pending') return res.send("Déjà traité");

    // Mettre à jour transaction
    await supabase
      .from('cinetpay_transactions')
      .update({ status, provider_transaction_id, updated_at: new Date() })
      .eq('id', transaction_id);

    // Si dépôt réussi → créditer utilisateur
    if (status === 'success' && trx.transaction_type === 'deposit') {
      const { data: user } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', trx.user_id)
        .single();
      await supabase
        .from('profiles')
        .update({ wallet_balance: user.wallet_balance + trx.amount })
        .eq('id', trx.user_id);

      await supabase
        .from('wallet_transactions')
        .insert({
          user_id: trx.user_id,
          amount: trx.amount,
          transaction_type: 'deposit',
          status: 'success',
          description: 'Recharge CinetPay',
          operator: trx.operator,
          phone: trx.phone
        });
    }

    // Si retrait échoué → rembourser
    if (status === 'failed' && trx.transaction_type === 'withdraw') {
      const { data: user } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', trx.user_id)
        .single();
      await supabase
        .from('profiles')
        .update({ wallet_balance: user.wallet_balance + trx.amount })
        .eq('id', trx.user_id);
    }

    res.send("OK");
  } catch (err) {
    console.error("Erreur webhook:", err.message);
    res.status(500).send("Erreur serveur webhook");
  }
});

// =====================
// 🚀 Lancement serveur
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend wallet live sur port ${PORT}`));
