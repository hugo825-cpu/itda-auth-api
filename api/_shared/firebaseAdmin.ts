import * as admin from "firebase-admin";

// Vercel 서버리스에서 중복 초기화 방지
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const db = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
