// src/lib/firestore.ts
import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// You should set these in your environment variables or use a service account JSON file

const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
} as ServiceAccount;

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const db = getFirestore();

// Helper functions
export async function getDoc<T = any>(collection: string, docId: string): Promise<T | null> {
  const doc = await db.collection(collection).doc(docId).get();
  return doc.exists ? (doc.data() as T) : null;
}

export async function setDoc(collection: string, docId: string, data: any): Promise<void> {
  await db.collection(collection).doc(docId).set(data, { merge: true });
}

export async function getAllDocs<T = any>(collection: string): Promise<T[]> {
  const snap = await db.collection(collection).get();
  return snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as T);
}
