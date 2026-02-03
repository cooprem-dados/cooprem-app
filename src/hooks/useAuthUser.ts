import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { User } from "../types";
import { auth, db } from "../firebase/firebaseConfig";

export function useAuthUser() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setCurrentUser(null);
          return;
        }

        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          await signOut(auth);
          setCurrentUser(null);
          return;
        }

        const userData = { ...(snap.data() as any), id: u.uid } as User;
        setCurrentUser(userData);
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsub();
  }, []);

  return { currentUser, setCurrentUser, loadingAuth };
}
