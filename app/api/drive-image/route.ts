import { NextResponse } from "next/server";

/** Google Drive file IDs in /file/d/{id}/ URLs */
const DRIVE_FILE_ID_RE = /^[a-zA-Z0-9_-]{10,128}$/;

/**
 * Fetches a publicly shared Drive image server-side and streams it to <img>.
 * Browser <img> requests to drive.google.com often get HTML (login / interstitial)
 * even when the file is "Anyone with the link"; same URLs usually work from a server fetch.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !DRIVE_FILE_ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const enc = encodeURIComponent(id);
  const candidates = [
    `https://drive.google.com/thumbnail?id=${enc}&sz=w2000`,
    `https://drive.google.com/uc?export=download&id=${enc}`,
    `https://drive.google.com/uc?export=view&id=${enc}`,
  ];

  const headers: HeadersInit = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  };

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers,
        cache: "no-store",
      });
      const rawCt = res.headers.get("content-type") || "";
      const ct = rawCt.split(";")[0].trim().toLowerCase();
      if (!res.ok) continue;
      if (!ct.startsWith("image/")) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 15 * 1024 * 1024) continue;
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": ct,
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    {
      error:
        "Could not load image from Google Drive. Confirm the file is shared as “Anyone with the link” (Viewer).",
    },
    { status: 404 },
  );
}
