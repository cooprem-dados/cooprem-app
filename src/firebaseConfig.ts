import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCynuJgfPszmLQ6eiH7x26jg_bMwxj991Q",
  authDomain: "projetocooprem.firebaseapp.com",
  projectId: "projetocooprem",
  storageBucket: "projetocooprem.firebasestorage.app",
  messagingSenderId: "303024881460",
  appId: "1:303024881460:web:40acb6eb6cddec3a326f61",
  measurementId: "G-MW80C4RRGR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);