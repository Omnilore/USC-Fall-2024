/**
 * Same-origin proxy: browsers often get HTML from Google on direct Drive URLs
 * (login / interstitial) even when the file is "Anyone with the link".
 * `/api/drive-image` fetches the bytes server-side and returns real image/*.
 */
function driveImageUrlFromFileId(fileId: string): string {
  return `/api/drive-image?id=${encodeURIComponent(fileId)}`;
}

export function resolveEmbeddablePhotoUrl(
  raw: string | null | undefined,
): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  let url = raw.trim();
  if (!url) return undefined;

  url = url.replace(/^h+(ttps?:\/\/)/i, "https://");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host !== "drive.google.com") {
      return url;
    }

    const fileIdFromPath = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
    if (fileIdFromPath) {
      return driveImageUrlFromFileId(fileIdFromPath);
    }

    if (u.pathname === "/open" || u.pathname.startsWith("/open")) {
      const openId = u.searchParams.get("id");
      if (openId) {
        return driveImageUrlFromFileId(openId);
      }
    }

    if (u.pathname.includes("/uc") && u.searchParams.get("id")) {
      return url.split("#")[0];
    }
  } catch {
    return url;
  }

  return url;
}
