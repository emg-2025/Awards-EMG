// Webhook appelé par Orange Money quand un paiement est confirmé (notif_url).
// Même logique que wave-webhook.js, adaptée au format de notification Orange.

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // TODO: vérifier l'authenticité de la notification selon la doc Orange Money Web Payment.
  const payload = JSON.parse(event.body || "{}");

  if (payload.status !== "SUCCESS") {
    return { statusCode: 200, body: "ignoré" };
  }

  const reference = payload.order_id; // format: nomineeId_packId_timestamp
  if (!reference) {
    return { statusCode: 400, body: "Référence manquante" };
  }

  const parts = reference.split("_");
  const timestamp = parts.pop();
  const packId = parts.pop();
  const nomineeId = parts.join("_");
  const PACK_VOTES = { pack3: 3, pack10: 10, pack25: 25, pack50: 50 };
  const votesToAdd = PACK_VOTES[packId] || 0;

  if (votesToAdd === 0) {
    return { statusCode: 400, body: "Pack inconnu" };
  }

  try {
    const nomineeRef = db.collection("nominees").doc(nomineeId);
    await db.runTransaction(async (t) => {
      const doc = await t.get(nomineeRef);
      const current = doc.exists ? (doc.data().votes || 0) : 0;
      t.set(nomineeRef, { votes: current + votesToAdd }, { merge: true });
    });

    await db.collection("transactions").add({
      nomineeId,
      packId,
      votes: votesToAdd,
      montant: payload.amount,
      methode: "orange",
      reference,
      statut: "confirme",
      date: admin.firestore.FieldValue.serverTimestamp()
    });

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Erreur serveur" };
  }
};
