import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "../types";
import { auth, db, firebaseConfig } from "../firebase/firebaseConfig";

export async function createUser(u: Omit<User, "id"> & { password?: string }) {
  const secApp = initializeApp(firebaseConfig, `Sec_${Date.now()}`);
  const secAuth = getAuth(secApp);

  try {
    const cred = await createUserWithEmailAndPassword(secAuth, u.email, u.password || "123456");

    await setDoc(doc(db, "users", cred.user.uid), {
      name: u.name,
      email: u.email,
      role: u.role,
      agency: u.agency,
      disabled: false,
      disabledAt: null,
      disabledBy: null,
      createdAt: serverTimestamp(),
    });

    return { ...u, password: undefined, id: cred.user.uid } as User;
  } finally {
    await deleteApp(secApp);
  }
}

export async function disableUser(id: string) {
  await updateDoc(doc(db, "users", id), {
    disabled: true,
    disabledAt: serverTimestamp(),
    disabledBy: auth.currentUser?.uid || null,
  });
}

export async function enableUser(id: string) {
  await updateDoc(doc(db, "users", id), {
    disabled: false,
    disabledAt: null,
    disabledBy: null,
  });
}

export async function updateUser(id: string, d: Partial<User>) {
  await updateDoc(doc(db, "users", id), d as any);
}
