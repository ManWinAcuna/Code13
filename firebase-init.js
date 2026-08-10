// Firebase project for Code13 - Auth (email/password) + Firestore (cloud
// copy of the localStorage data), so a signed-in user's Database/Profile/
// etc. survive reinstalling the home-screen shortcut or switching devices.
//
// PLACEHOLDER - this points nowhere yet. Code13 uses a fully separate
// Firebase project from numerology-app (locked decision, see
// project_code13_boost13_spec memory) so its users/data never mix with the
// personal tool. Creating that project requires signing into the Firebase
// console with your own Google account, which isn't something that can be
// done on your behalf - once it exists, replace the config below with the
// real one from Project Settings > General > Your apps > SDK setup.
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.firebasestorage.app",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

firebase.initializeApp(firebaseConfig);
