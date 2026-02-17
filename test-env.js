// test-env.js
console.log("🔹 Vérification des variables d'environnement");

// Supabase
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_KEY:", process.env.SUPABASE_SERVICE_KEY);

// FedaPay
console.log("FEDA_API_KEY:", process.env.FEDA_API_KEY);

// Vérification simple
if (!process.env.SUPABASE_URL) console.error("❌ SUPABASE_URL non définie !");
if (!process.env.SUPABASE_SERVICE_KEY) console.error("❌ SUPABASE_SERVICE_KEY non définie !");
if (!process.env.FEDA_API_KEY) console.error("❌ FEDA_API_KEY non définie !");
