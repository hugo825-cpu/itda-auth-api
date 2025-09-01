import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

// Firebase Admin 초기화 (환경변수 사용)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken } = req.body as { accessToken?: string };
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing accessToken' });
    }

    // 네이버 사용자 정보 요청
    const response = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    if (!data.response) {
      return res.status(400).json({ error: 'Failed to fetch Naver user info', details: data });
    }

    const { id, email, name } = data.response;

    // Firebase UID 생성
    const uid = `naver:${id}`;

    // Firebase 사용자 생성/업데이트
    await admin.auth().updateUser(uid, {
      email: email || undefined,
      displayName: name || undefined,
    }).catch(async (err) => {
      if (err.code === 'auth/user-not-found') {
        await admin.auth().createUser({
          uid,
          email: email || undefined,
          displayName: name || undefined,
        });
      } else {
        throw err;
      }
    });

    // Firebase Custom Token 발급
    const customToken = await admin.auth().createCustomToken(uid);

    return res.status(200).json({ customToken });
  } catch (err: any) {
    console.error('[NaverAuth ERROR]', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}}