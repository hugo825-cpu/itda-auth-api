// itda-api/api/_shared/firebaseAdmin.ts
import * as admin from "firebase-admin";

// Vercel 서버리스 환경에서는 여러 번 초기화될 수 있어서 체크 필요
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// Firebase 서비스 export
export const auth = admin.auth();
export const db = admin.firestore();

// 필요하면 admin 전체도 기본 export
export default admin;