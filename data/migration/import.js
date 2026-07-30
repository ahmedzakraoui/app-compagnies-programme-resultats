const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore'); // Importation explicite de Firestore
const serviceAccount = require('./cle-privee.json');

// Chargement de TOUS tes fichiers JSON de données
const bureaux = require('./Bureaux.json');
const programmes = require('./Programmes.json');
const resultats = require('./Resultats.json');
const users = require('./Users.json');

// Connexion sécurisée à ton projet Firebase
initializeApp({
  credential: cert(serviceAccount)
});

// Initialisation de la base de données Firestore
const db = getFirestore();

async function executerMigration() {
  console.log("🚀 Début de l'importation complète vers Firestore...");

  // Liste des collections à importer
  const tâches = [
    { nom: 'bureaux', donnees: bureaux },
    { nom: 'programmes', donnees: programmes },
    { nom: 'resultats', donnees: resultats },
    { nom: 'users', donnees: users }
  ];

  for (const tâche of tâches) {
    console.log(`\n📦 Importation de la collection "${tâche.nom}"...`);
    const collectionRef = db.collection(tâche.nom);

    for (const item of tâche.donnees) {
      // Si ta ligne contient un champ 'id' ou 'ID', on l'utilise comme ID de document, sinon Firebase le génère automatiquement
      const rawId = item.id || item.ID;
      const docId = rawId ? String(rawId) : null;
      const docRef = docId ? collectionRef.doc(docId) : collectionRef.doc();
      
      await docRef.set(item);
      console.log(`  ✅ Document synchronisé dans ${tâche.nom} : ${docRef.id}`);
    }
  }

  console.log("\n🎉 Fantastique ! Toutes tes bases (Bureaux, Programmes, Résultats, Users) sont maintenant dans le Cloud.");
}

executerMigration().catch(error => {
  console.error("❌ Erreur critique pendant la migration :", error);
});