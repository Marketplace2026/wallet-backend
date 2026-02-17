require('dotenv').config();
const express = require('express');
const cors = require('cors');
const FedaPay = require('fedapay');

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 CONFIGURATION FedaPay SANDBOX
FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY); // mets ta clé sk_sandbox ici dans .env
FedaPay.setEnvironment('sandbox');

// 🧪 Route test
app.get('/', (req, res) => {
  res.send('Backend FedaPay OK 🚀');
});

// 💰 Route dépôt
app.post('/deposit', async (req, res) => {
  try {
    const { userId, amount, phone } = req.body;

    if (!userId || !amount || !phone) {
      return res.status(400).json({
        success: false,
        error: "Données manquantes"
      });
    }

    // 🔹 Création de la transaction FedaPay
    const transaction = await FedaPay.Transaction.create({
      description: `Recharge wallet utilisateur ${userId}`,
      amount: Number(amount),
      currency: { iso: "XOF" },
      callback_url: "https://marketplace2026.github.io/MANG---March-Agricole/callback.html", // à remplacer par ta page callback réelle
      customer: {
        firstname: "Client",
        lastname: "Wallet",
        phone_number: phone,
        email: "client@test.com"
      }
    });

    // 🔹 Générer le lien de paiement
    await transaction.generateToken();

    return res.json({
      success: true,
      payment_url: transaction.token.url
    });

  } catch (error) {
    console.error("Erreur FedaPay:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      error: "Erreur serveur FedaPay"
    });
  }
});

// 🚀 Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
