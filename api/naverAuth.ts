import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_shared/firebaseAdmin";

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
    age?: string;       // 예: "20-29"
    birthday?: string;  // MM-DD
    birthyear?: string; // YYYY
    mobile?: string;
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    // 1) JSON Body 파싱
    const body = await readJsonBody(req);
    const accessToken: string | undefined = body?.accessToken;
    if (!accessToken) return res.status(400).json({ error: "accessToken missing" });

    // 2) 네이버 프로필 조회
    const me = await getNaverProfile(accessToken);
    if (me.resultcode !== "00" || !me.response?.id) {
      return res.status(401).json({ error: "Invalid Naver access token", detail: me });
    }

    const nav = me.response;
    const naverId = nav.id;

    // 3) Firestore 저장 (users/naver:{id})
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

    // 4) 응답
    return res.status(200).json({
      ok: true,
      uid: `naver:${naverId}`,
      profile: {
        email: nav.email ?? null,
        name: nav.name ?? null,
        nickname: nav.nickname ?? null,
        profileImage: nav.profile_image ?? null,
      },
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server Error" });
  }
}

/** Request Body JSON 안전 파싱 */
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

/** 네이버 프로필 조회 */
async function getNaverProfile(accessToken: string): Promise<NaverMeResponse> {
  const r = await fetch("https://openapi.naver.com/v1/nid/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await r.json()) as NaverMeResponse;
}
