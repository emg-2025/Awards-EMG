# Paiya de la Gloire — Site de vote (gratuit, vérifié par SMS)

Site de vote par catégories, **gratuit**, avec un vote par numéro de téléphone et par catégorie (vérifié par un code envoyé par SMS). Compteurs en temps réel via Firebase Firestore, hébergé sur Netlify.

## Ce qui a changé par rapport à la version payante

- Plus de paiement Wave / Orange Money : voter est gratuit.
- Un votant doit entrer son numéro de téléphone, recevoir un code par SMS, puis le saisir pour valider son vote.
- Chaque numéro de téléphone ne peut voter **qu'une seule fois par catégorie** (imposé côté serveur, pas seulement côté navigateur).
- `merci.html` n'est plus utilisé dans le parcours (tout se passe désormais dans la fenêtre de vote) — vous pouvez le supprimer ou le garder de côté.

## Structure du projet

```
mon-site-vote/
├── index.html          → page de vote (catégories, nominés, vérification SMS)
├── package.json         → dépendances des fonctions (firebase-admin, twilio)
├── netlify.toml         → config Netlify (dossier des fonctions)
└── netlify/
    └── functions/
        ├── send-code.js     → génère un code, l'enregistre dans Firestore, l'envoie par SMS (Twilio)
        └── verify-vote.js   → vérifie le code puis ajoute le vote (une seule fois par numéro/catégorie)
```

## Comment fonctionne le vote

1. La personne clique « Voter » sur un nominé, entre son numéro de téléphone.
2. `send-code.js` génère un code à 6 chiffres, le stocke dans Firestore (`otp_codes`, expire après 5 minutes) et l'envoie par SMS via Twilio.
3. La personne saisit le code reçu.
4. `verify-vote.js` vérifie le code, puis incrémente le compteur du nominé dans Firestore et enregistre le numéro dans `votes_log` pour empêcher un second vote dans la même catégorie.

## Étapes pour rendre le site fonctionnel

### 1. Firebase (base de données des votes)

1. Créez un projet sur [console.firebase.google.com](https://console.firebase.google.com).
2. Activez **Firestore Database** (mode production).
3. Créez la collection `nominees`, un document par candidat :
   ```
   { nom: "Nom complet", categorie: "reine" | "roi", votes: 0, photo: "URL (optionnel)" }
   ```
   L'ID du document doit suivre le format `categorie__nom-en-minuscules-avec-tirets` (ex. `reine__aicha-kone`).
4. Dans **Règles** Firestore, autorisez la lecture publique des nominés mais bloquez toute écriture directe (seules les fonctions Netlify, via la clé de service, écrivent) :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /nominees/{docId} {
         allow read: if true;
         allow write: if false;
       }
       match /otp_codes/{docId} {
         allow read, write: if false;
       }
       match /votes_log/{docId} {
         allow read, write: if false;
       }
     }
   }
   ```
5. Copiez la config web (Paramètres du projet ⚙️ → Général → Vos applications → Ajouter une app Web) dans `index.html`, section `firebaseConfig`.
6. Générez une clé de compte de service (Paramètres → Comptes de service → Générer une nouvelle clé privée) — gardez ce fichier secret. Vous en tirerez `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

### 2. Twilio (envoi des codes par SMS)

1. Créez un compte sur [twilio.com](https://www.twilio.com) et récupérez, dans la Console :
   - `Account SID` → variable `TWILIO_ACCOUNT_SID`
   - `Auth Token` → variable `TWILIO_AUTH_TOKEN`
   - un numéro Twilio capable d'envoyer des SMS → variable `TWILIO_PHONE_NUMBER`
2. Vérifiez que votre compte Twilio peut envoyer des SMS vers la Côte d'Ivoire (selon votre offre, un compte d'essai peut être limité aux numéros vérifiés — passez en compte payant avant l'ouverture publique).

### 3. Déploiement Netlify

1. Glissez-déposez le dossier complet sur [app.netlify.com/drop](https://app.netlify.com/drop), ou connectez un dépôt Git.
2. Netlify installe automatiquement les dépendances (`firebase-admin`, `twilio`) et déploie les fonctions.
3. Dans **Site settings → Environment variables**, ajoutez les 6 variables : `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
4. Redéployez (**Deploys → Trigger deploy**) pour que les variables soient prises en compte.

### 4. Test avant ouverture publique

1. Sur le site en ligne, cliquez « Voter » sur un candidat test, entrez un vrai numéro de téléphone.
2. Vérifiez la réception du SMS et la validation du code.
3. Vérifiez dans Firestore que `votes` a augmenté et qu'un document est apparu dans `votes_log`.
4. Essayez de revoter avec le même numéro dans la même catégorie : le site doit refuser.
5. En cas d'échec, consultez les logs (**Netlify → Functions → send-code / verify-vote**).

## À compléter avant le lancement

- Remplacer les nominés provisoires codés dans `index.html` par la vraie liste de candidats, directement dans Firestore (nom + éventuellement une photo).
- Passer le compte Twilio en mode payant si ce n'est pas déjà fait, pour envoyer des SMS à n'importe quel numéro.
- Éventuellement ajouter une limite anti-abus supplémentaire (ex. nombre de codes envoyés par heure et par IP) si le volume de trafic le justifie.
