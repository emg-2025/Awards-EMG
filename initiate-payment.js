// Fonction Netlify : initialise un paiement Wave ou Orange Money pour un pack de votes.
// Appelée par index.html via POST /.netlify/functions/initiate-payment

const fetch = global.fetch || require("node-fetch");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { nomineeId, nomineeName, category, packId, votes, amount, method } = JSON.parse(event.body || "{}");

  if (!nomineeId || !packId || !amount || !method) {
    return { statusCode: 400, body: JSON.stringify({ error: "Paramètres manquants." }) };
  }

  const siteUrl = process.env.URL || "https://votre-site.netlify.app";
  // On encode les infos du vote dans l'URL de retour pour retrouver la transaction après paiement.
  const reference = `${nomineeId}_${packId}_${Date.now()}`;
  const successUrl = `${siteUrl}/merci.html?ref=${reference}&nominee=${encodeURIComponent(nomineeId)}&votes=${votes}`;
  const errorUrl = `${siteUrl}/?erreur=paiement`;

  try {
    if (method === "wave") {
      // Documentation : https://docs.wave.com/business/checkout
      const resp = await fetch("https://api.wave.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WAVE_API_KEY}`, // TODO: définir dans Netlify > Environment variables
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: String(amount),
          currency: "XOF",
          error_url: errorUrl,
          success_url: successUrl,
          client_reference: reference
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error("Erreur Wave:", data);
        return { statusCode: 502, body: JSON.stringify({ error: "Le paiement Wave n'a pas pu être initialisé." }) };
      }
      // Enregistrer la transaction en "attente" dans Firestore ici (voir README) avant de rediriger.
      return { statusCode: 200, body: JSON.stringify({ paymentUrl: data.wave_launch_url, reference }) };
    }

    if (method === "orange") {
      // L'API Orange Money Web Payment nécessite un token OAuth (client_id/secret)
      // puis un appel à l'endpoint de paiement web. Voir README pour les étapes complètes.
      const tokenResp = await fetch("https://api.orange.com/oauth/v3/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${process.env.ORANGE_BASIC_AUTH}`, // TODO: base64(client_id:client_secret)
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok) {
        console.error("Erreur token Orange:", tokenData);
        return { statusCode: 502, body: JSON.stringify({ error: "Le paiement Orange Money n'a pas pu être initialisé." }) };
      }

      const payResp = await fetch("https://api.orange.com/orange-money-webpay/ci/v1/webpayment", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          merchant_key: process.env.ORANGE_MERCHANT_KEY, // TODO: définir dans Netlify
          currency: "OUV", // code devise Orange Money CI
          order_id: reference,
          amount: amount,
          return_url: successUrl,
          cancel_url: errorUrl,
          notif_url: `${siteUrl}/.netlify/functions/orange-webhook`,
          lang: "fr",
          reference: `Votes ${category} - ${nomineeName}`
        })
      });
      const payData = await payResp.json();
      if (!payResp.ok) {
        console.error("Erreur paiement Orange:", payData);
        return { statusCode: 502, body: JSON.stringify({ error: "Le paiement Orange Money n'a pas pu être initialisé." }) };
      }
      return { statusCode: 200, body: JSON.stringify({ paymentUrl: payData.payment_url, reference }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Moyen de paiement inconnu." }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Erreur serveur." }) };
  }
};
