// Firebase project for Code13 - Auth (email/password) + Firestore (the
// early-access waitlist now; cloud copy of localStorage data once accounts
// go live). Fully separate project from numerology-app (locked decision,
// see project_code13_boost13_spec memory) so its users/data never mix with
// the personal tool.
//
// Real config since 2026-08-22 (project code13-fec0f, web app "Code13
// Web"). This web config is PUBLIC by design - security lives in the
// Firestore rules, not here.
const firebaseConfig = {
  apiKey: "AIzaSyAlp9dzx6GLC2iLBwhpfNQzZXyd-keLkP8",
  authDomain: "code13-fec0f.firebaseapp.com",
  projectId: "code13-fec0f",
  storageBucket: "code13-fec0f.firebasestorage.app",
  messagingSenderId: "933756902128",
  appId: "1:933756902128:web:ac140b295fd1aa5dab4035",
};

firebase.initializeApp(firebaseConfig);
