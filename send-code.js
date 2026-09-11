// Fonction Netlify : envoie un code de vérification par SMS pour valider un vote gratuit.
// Appelée par index.html via POST /.netlify/functions/send-code

const admin = require("firebase-admin");
const twilio = require("twilio");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
    })
  });
}
const db = admin.firestore();

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Normalise un numéro ivoirien (10 chiffres depuis 2021) au format international +225XXXXXXXXXX
function normalizePhone(raw) {
  const digits = (raw || "").replace(/[^0-9+]/g, "");
  if (digits.startsWith("+225")) return digits;
  if (digits.startsWith("225")) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+225" + digits.slice(1);
  if (digits.length === 10) return "+225" + digits;
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { phone, category } = JSON.parse(event.body || "{}");
  const normalized = normalizePhone(phone);

  if (!normalized || !category) {
    return { statusCode: 400, body: JSON.stringify({ error: "Numéro de téléphone invalide." }) };
  }

  const docId = `${category}__${normalized}`;
  const otpRef = db.collection("otp_codes").doc(docId);
  const voteLogRef = db.collection("votes_log").doc(docId);

  // Empêche de redemander un code si ce numéro a déjà voté dans cette catégorie
  const voteLogDoc = await voteLogRef.get();
  if (voteLogDoc.exists) {
    return { statusCode: 409, body: JSON.stringify({ error: "Ce numéro a déjà voté dans cette catégorie." }) };
  }

  // Empêche l'envoi répété de codes en boucle (1 envoi par minute max)
  const existing = await otpRef.get();
  if (existing.exists) {
    const secondsSinceLast = (Date.now() - existing.data().createdAt) / 1000;
    if (secondsSinceLast < 60) {
      return { statusCode: 429, body: JSON.stringify({ error: "Veuillez patienter avant de redemander un code." }) };
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  await otpRef.set({ code, expiresAt, createdAt: Date.now(), phone: normalized, category });

  try {
    await twilioClient.messages.create({
      body: `Votre code de vote : ${code} (valable 5 minutes)`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: normalized
    });
  } catch (err) {
    console.error("Erreur envoi SMS:", err);
    return { statusCode: 502, body: JSON.stringify({ error: "Impossible d'envoyer le SMS. Vérifiez le numéro." }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
