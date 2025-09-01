import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as admin from "firebase-admin";

// Firebase Admin 초기화 (중복 방지)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || "aid-community-3dda6",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const body = await readJsonBody(req);
    const accessToken: string | undefined = body?.accessToken;
    if (!accessToken) return res.status(400).json({ error: "accessToken missing" });

    const me = await getNaverProfile(accessToken);
    if (me.resultcode !== "00" || !me.response?.id) {
      return res.status(401).json({ error: "Invalid Naver access token", detail: me });
    }

    const nav = me.response;
    const naverId = nav.id;

    const userRef = db.collection("users").doc(`naver:${naverId}`);
    const snap = await userRef.get();
    const now = new Date().toISOString();

    await userRef.set(
      {
        provider: "naver",
        naverId,
        email: nav.email ?? null,
        name: nav.name ?? null,
        nickname: nav.nickname ?? null,
        profileImage: nav.profile_image ?? null,
        gender: nav.gender ?? null,
        ageRange: nav.age ?? null,
        birthday: nav.birthday ?? null,
        birthyear: nav.birthyear ?? null,
        mobile: nav.mobile ?? null,
        updatedAt: now,
        createdAt: snap.exists ? snap.get("createdAt") ?? now : now,
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      uid: `naver:${naverId}`,
      profile: {
        email: nav.email ?? null,
        name: nav.name ?? null,
        nickname: nav.nickname ?? null,
        profileImage: nav.profile_image ?? null,
      },
      // 디버깅용 배포 식별자
      vercelCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server Error" });
  }
}

// helpers
async function readJsonBody(req: VercelRequest): Promise<any> {
  if (typeof req.body === "object" && req.body !== null) return req.body;
  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve) => {
    req.on("data", (c) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve());
  });
  const raw = Buffer.concat(chunks).toString() || "{}";
  return JSON.parse(raw);
}

async function getNaverProfile(accessToken: string): Promise<NaverMeResponse> {
  const r = await fetch("https://openapi.naver.com/v1/nid/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await r.json()) as NaverMeResponse;
}
EOF
