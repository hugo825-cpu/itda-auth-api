// api/naverCallback.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error, error_description } = req.query as Record<string,string>;
  console.log("NAVER CALLBACK:", { code, state, error, error_description });

  if (error) {
    return res.status(400).send(`OAuth error: ${error} - ${error_description || ""}`);
  }
  if (!code) {
    return res.status(400).send("Missing code");
  }

  // 여기서 바로 토큰 교환까지 해도 되고, 일단은 성공만 표시
  return res.status(200).send(`Received code=${code}, state=${state}`);
}