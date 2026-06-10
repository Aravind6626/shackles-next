import { getStorageProvider, shouldUseDigitalOcean, shouldUseLocal } from "./storage-provider";
import { createSpacesSignedGetUrl } from "./digitalocean/spaces";

/**
 * Resolves an abstract/presentation storage reference into an actionable URL.
 * If the value is a full HTTP URL or a local /api/files route, it returns it as-is.
 * If it's a raw object key (from S3/Spaces), it generates a fresh signed URL valid for 1 hour.
 */
export async function getDownloadUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;

  // If it's already a full URL or a relative local API route, return it directly.
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://") || pathOrUrl.startsWith("/api/")) {
    return pathOrUrl;
  }

  // Otherwise, treat it as an object key and generate a signed URL
  const storageProvider = getStorageProvider();
  
  if (shouldUseDigitalOcean(storageProvider)) {
    try {
      // Generate a URL valid for 1 hour (3600 seconds)
      return await createSpacesSignedGetUrl(pathOrUrl, 3600);
    } catch (err) {
      console.error("Error generating signed URL for key:", pathOrUrl, err);
      return null;
    }
  }

  // Fallback for local dev if they changed providers without migrating data
  return `/api/files/paper-submission/${pathOrUrl}`;
}
