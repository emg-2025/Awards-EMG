// Fonction Netlify : vérifie le code SMS puis enregistre le vote (gratuit, 1 par numéro et par catégorie).
// Appelée par index.html via POST /.netlify/functions/verify-vote

const admin = require("firebase-admin");

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

  const { phone, category, nomineeId, code } = JSON.parse(event.body || "{}");
  const normalized = normalizePhone(phone);

  if (!normalized || !category || !nomineeId || !code) {
    return { statusCode: 400, body: JSON.stringify({ error: "Paramètres manquants." }) };
  }

  const docId = `${category}__${normalized}`;
  const otpRef = db.collection("otp_codes").doc(docId);
  const voteLogRef = db.collection("votes_log").doc(docId);

  const otpDoc = await otpRef.get();
  if (!otpDoc.exists) {
    return { statusCode: 400, body: JSON.stringify({ error: "Aucun code demandé pour ce numéro." }) };
  }

  const otpData = otpDoc.data();
  if (Date.now() > otpData.expiresAt) {
    return { statusCode: 400, body: JSON.stringify({ error: "Code expiré, demandez-en un nouveau." }) };
  }
  if (String(code) !== String(otpData.code)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Code incorrect." }) };
  }

  try {
    await db.runTransaction(async (t) => {
      const voteLogDoc = await t.get(voteLogRef);
      if (voteLogDoc.exists) {
        throw new Error("ALREADY_VOTED");
      }
      const nomineeRef = db.collection("nominees").doc(nomineeId);
      const nomineeDoc = await t.get(nomineeRef);
      const current = nomineeDoc.exists ? (nomineeDoc.data().votes || 0) : 0;
      t.set(nomineeRef, { votes: current + 1 }, { merge: true });
      t.set(voteLogRef, {
        phone: normalized,
        category,
        nomineeId,
        date: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await otpRef.delete();

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    if (err.message === "ALREADY_VOTED") {
      return { statusCode: 409, body: JSON.stringify({ error: "Ce numéro a déjà voté dans cette catégorie." }) };
    }
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Erreur serveur." }) };
  }
};
