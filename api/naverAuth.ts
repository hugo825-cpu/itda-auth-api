// itda-api/api/naverAuth.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth, db } from '../_shared/firebaseAdmin';

// (선택) Node 런타임 고정
export const config = { runtime: 'nodejs' };

type NaverMeResponse = {
  resultcode: string;
  message: string;
  response?: {
    id: string;
    email?: string;
    nickname?: string;
    name?: string;
    profile_image?: string;
    gender?: string;
    age?: string;
    birthday?: string;
    birthyear?: string;
    mobile?: string;
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS(원하면 추가)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1) Body
    const body = await readJsonBody(req);
    const accessToken: string | undefined = body?.accessToken;
    if (!accessToken) return res.status(400).json({ error: 'accessToken missing' });

    // 2) 네이버 프로필 조회
    const me = await getNaverProfile(accessToken);
    if (me.resultcode !== '00' || !me.response?.id) {
      return res.status(401).json({ error: 'Invalid Naver access token', detail: me });
    }

    const nav = me.response;
    const uid = `naver:${nav.id}`;

    // 3) Firebase Auth에 유저 upsert
    await auth.updateUser(uid, {
      email: nav.email || undefined,
      displayName: nav.name || nav.nickname || undefined,
      photoURL: nav.profile_image || undefined,
    }).catch(async (err: any) => {
      if (err.code === 'auth/user-not-found') {
        await auth.createUser({
          uid,
          email: nav.email || undefined,
          displayName: nav.name || nav.nickname || undefined,
          photoURL: nav.profile_image || undefined,
        });
      } else {
        throw err;
      }
    });

    // 4) Firestore 최소 정보 upsert
    const now = new Date().toISOString();
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    await userRef.set({
      provider: 'naver',
      email: nav.email ?? null,
      name: nav.name ?? null,
      nickname: nav.nickname ?? null,
      photoURL: nav.profile_image ?? null,
      gender: nav.gender ?? null,
      ageRange: nav.age ?? null,
      birthday: nav.birthday ?? null,
      birthyear: nav.birthyear ?? null,
      mobile: nav.mobile ?? null,
      updatedAt: now,
      createdAt: snap.exists ? snap.get('createdAt') ?? now : now,
    }, { merge: true });

    // 5) Custom Token 발급
    const customToken = await auth.createCustomToken(uid);

    // 6) 응답
    res.setHeader('Access-Control-Allow-Origin', '*'); // (CORS)
    return res.status(200).json({ customToken, uid });
  } catch (e: any) {
    console.error('[naverAuth]', e);
    return res.status(500).json({ error: e?.message || 'Server Error' });
  }
}

/* Body JSON 파서 */
async function readJsonBody(req: VercelRequest): Promise<any> {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve) => {
    req.on('data', (c) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve());
  });
  const raw = Buffer.concat(chunks).toString() || '{}';
  return JSON.parse(raw);
}

/* 네이버 프로필 */
async function getNaverProfile(accessToken: string): Promise<NaverMeResponse> {
  const r = await fetch('https://openapi.naver.com/v1/nid/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await r.json()) as NaverMeResponse;
}