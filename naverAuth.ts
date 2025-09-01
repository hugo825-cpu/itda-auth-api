import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import * as admin from 'firebase-admin';

const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { accessToken } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ error: 'missing accessToken' });
    }

    // 1) 네이버 프로필 조회
    //   doc: https://developers.naver.com/docs/login/profile/profile.md
    const meResp = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const meJson: any = await meResp.json();
    if (!meResp.ok || meJson?.resultcode !== '00') {
      return res.status(401).json({ error: 'naver token invalid', detail: meJson });
    }

    const naverId = meJson?.response?.id;
    if (!naverId) {
      return res.status(500).json({ error: 'naver id missing', raw: meJson });
    }

    // 2) Firebase custom token 발급
    const uid = `naver:${naverId}`;
    const customToken = await app.auth().createCustomToken(uid, {
      provider: 'naver',
    });

    return res.status(200).json({ customToken });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}