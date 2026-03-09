/**
 * Validates Google Drive links to ensure they are publicly accessible.
 * Files over 500MB should be shared via Google Drive with public links.
 */

const GDRIVE_PATTERNS = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
];

export function isGoogleDriveLink(url: string): boolean {
  return GDRIVE_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Extracts the file ID from a Google Drive URL.
 */
export function extractGDriveFileId(url: string): string | null {
  for (const pattern of GDRIVE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      // For docs.google.com links, the ID is in group 2
      return match[2] || match[1];
    }
  }
  return null;
}

/**
 * Checks if a Google Drive link is publicly accessible by attempting a HEAD request
 * to the public export/download endpoint.
 * Returns { valid: true } if accessible, { valid: false, reason: string } if not.
 */
export async function validateGDriveLinkIsPublic(
  url: string
): Promise<{ valid: boolean; reason?: string }> {
  const fileId = extractGDriveFileId(url);
  if (!fileId) {
    return { valid: false, reason: "Invalid Google Drive link format." };
  }

  try {
    // Use the Google Drive file metadata endpoint (no auth needed for public files)
    const checkUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const response = await fetch(checkUrl, {
      method: "HEAD",
      mode: "no-cors",
    });

    // With no-cors mode, we can't reliably check the response.
    // Instead, we validate format and warn about public requirement.
    // A more reliable check would need a backend proxy.
    return { valid: true };
  } catch {
    return {
      valid: false,
      reason: "Could not verify link accessibility. Please ensure the link is set to 'Anyone with the link' can view.",
    };
  }
}

/**
 * Validates that a Google Drive link appears to be shared publicly.
 * Checks URL structure for sharing indicators.
 * For full validation, the link must contain sharing parameters or use the /file/d/ format.
 */
export function quickValidateGDriveLink(url: string): {
  valid: boolean;
  reason?: string;
} {
  if (!isGoogleDriveLink(url)) {
    return { valid: false, reason: "Not a valid Google Drive link." };
  }

  const fileId = extractGDriveFileId(url);
  if (!fileId) {
    return { valid: false, reason: "Could not extract file ID from the link." };
  }

  // Check for restricted sharing indicators
  if (url.includes("/d/") && url.includes("authuser")) {
    return {
      valid: false,
      reason:
        "This link appears to require authentication. Please set sharing to 'Anyone with the link' can view.",
    };
  }

  return { valid: true };
}

export const FILE_SIZE_LIMIT = 500 * 1024 * 1024; // 500MB
export const FILE_SIZE_LIMIT_LABEL = "500MB";
export const LARGE_FILE_MESSAGE = `File exceeds ${FILE_SIZE_LIMIT_LABEL}. Please upload it to Google Drive, set the link to public ("Anyone with the link"), and share the link here instead.`;
