import type { VercelRequest, VercelResponse } from "@vercel/node";
import { admin, db } from "./_shared/firebaseAdmin"; // firebase-admin 초기화 모듈 (admin, db 둘 다 export 했다고 가정)

// ✅ 카카오 사용자 정보 타입
type KakaoUserResponse = {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // 1) Request Body 파싱
    const body = await readJsonBody(req);
    const accessToken: string | undefined = body?.accessToken;
    if (!accessToken) {
      return res.status(400).json({ error: "accessToken missing" });
    }

    // 2) 카카오 사용자 정보 조회
    const userInfo = await getKakaoProfile(accessToken);
    if (!userInfo.id) {
      return res.status(401).json({ error: "Invalid Kakao access token", detail: userInfo });
    }

    const kakaoId = userInfo.id.toString();
    const account = userInfo.kakao_account ?? {};

    // 3) Firestore에 저장
    const userRef = db.collection("users").doc(`kakao:${kakaoId}`);
    const snap = await userRef.get();
    const now = new Date().toISOString();

    await userRef.set(
      {
        provider: "kakao",
        kakaoId,
        email: account.email ?? null,
        nickname: account.profile?.nickname ?? null,
        profileImage: account.profile?.profile_image_url ?? null,
        updatedAt: now,
        createdAt: snap.exists ? snap.get("createdAt") ?? now : now,
      },
      { merge: true }
    );

    // 4) Firebase Custom Token 생성
    const uid = `kakao:${kakaoId}`;
    const customToken = await admin.auth().createCustomToken(uid);

    // 5) 응답
    return res.status(200).json({
      ok: true,
      uid,
      customToken,
      profile: {
        email: account.email ?? null,
        nickname: account.profile?.nickname ?? null,
        profileImage: account.profile?.profile_image_url ?? null,
      },
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server Error" });
  }
}

/** Request Body JSON 파싱 */
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

/** 카카오 프로필 조회 */
async function getKakaoProfile(accessToken: string): Promise<KakaoUserResponse> {
  const r = await fetch("https://kapi.kakao.com/v2/user/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await r.json()) as KakaoUserResponse;
}