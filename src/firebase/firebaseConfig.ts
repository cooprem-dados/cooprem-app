import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCynuJgfPszmLQ6eiH7x26jg_bMwxj991Q",
  authDomain: "projetocooprem.firebaseapp.com",
  projectId: "projetocooprem"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);