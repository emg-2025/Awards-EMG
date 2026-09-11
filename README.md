# Site de vote — Reine & Roi du Bal

## Ce qui est prêt
- `index.html` : page de vote (2 catégories, packs de votes, choix Wave / Orange Money)
- `merci.html` : page de confirmation après paiement
- `netlify/functions/initiate-payment.js` : lance le paiement (Wave ou Orange Money)
- `netlify/functions/wave-webhook.js` et `orange-webhook.js` : confirment le paiement et ajoutent les votes dans Firestore

## Étapes pour rendre le site fonctionnel

### 1. Firebase (base de données des votes)
1. Créez un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activez **Firestore Database**
3. Copiez la config (Paramètres du projet > Général > Vos applications) dans `index.html`, section `firebaseConfig`
4. Créez une collection `nominees` avec vos vrais candidats, un document par nominé :
   ```
   { nom: "Nom complet", categorie: "reine" | "roi", votes: 0 }
   ```
5. Pour les webhooks (fonctions serveur), générez une clé de compte de service (Paramètres > Comptes de service > Générer une nouvelle clé privée) et ajoutez dans Netlify (Site settings > Environment variables) :
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

### 2. Wave (Wave for Business)
1. Créez un compte marchand sur [wave.com/business](https://wave.com/business)
2. Récupérez votre clé API dans le tableau de bord
3. Ajoutez dans Netlify : `WAVE_API_KEY`
4. Configurez l'URL de webhook dans le dashboard Wave : `https://votre-site.netlify.app/.netlify/functions/wave-webhook`

### 3. Orange Money
1. Créez un compte sur [developer.orange.com](https://developer.orange.com), souscrivez à l'API "Orange Money Web Payment" (Côte d'Ivoire)
2. Récupérez `client_id` et `client_secret`, encodez `client_id:client_secret` en base64
3. Ajoutez dans Netlify : `ORANGE_BASIC_AUTH` (le base64) et `ORANGE_MERCHANT_KEY`
4. Configurez l'URL de notification : `https://votre-site.netlify.app/.netlify/functions/orange-webhook`

### 4. Déploiement
Glissez-déposez le dossier complet sur [app.netlify.com/drop](https://app.netlify.com/drop), ou connectez un dépôt Git. Netlify installera automatiquement les dépendances (`firebase-admin`, `node-fetch`) et déploiera les fonctions.

## À compléter plus tard
- Remplacer les nominés provisoires par la vraie liste dans Firestore (nom + éventuellement une photo)
- Le titre "Grand Bal Annuel" est un placeholder — dites-moi le vrai nom de l'événement pour que je l'intègre
