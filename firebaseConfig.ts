import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCynuJgfPszmLQ6eiH7x26jg_bMwxj991Q",
  authDomain: "projetocooprem.firebaseapp.com",
  projectId: "projetocooprem",
  storageBucket: "projetocooprem.firebasestorage.app",
  messagingSenderId: "303024881460",
  appId: "1:303024881460:web:40acb6eb6cddec3a326f61",
  measurementId: "G-MW80C4RRGR"
};

const app = !firebase.apps.length 
  ? firebase.initializeApp(firebaseConfig) 
  : firebase.app();

export const auth = app.auth();
export const db = app.firestore();
export default app;