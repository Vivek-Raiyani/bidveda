/**
 * Attachment parsing, formatting, and download utilities for RFQs and specifications.
 */

export interface ParsedAttachment {
  name: string;
  url: string;
  extension: string;
}

export interface ParsedRFQDescription {
  cleanDescription: string;
  attachment: ParsedAttachment | null;
}

/**
 * Extracts clean filename and extension from a raw URL.
 * Handles removing UUID hashes appended during upload:
 * e.g. "Spec_a4d9515db28145c5af8dddb516b60260.docx" -> "Spec.docx"
 */
export function extractCleanFilename(rawUrl: string): { name: string; extension: string } {
  try {
    const urlObj = new URL(rawUrl, "http://dummy.local");
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    let filename = decodeURIComponent(pathSegments[pathSegments.length - 1] || "document");

    // Remove trailing hash like _a4d9515db28145c5af8dddb516b60260 or _186b2402-b636-4f23-941d-3026ff36faf8 before extension
    const hashRegex = /^(.*)_[a-f0-9-]{32,36}(\.[a-zA-Z0-9]+)$/i;
    const match = filename.match(hashRegex);
    if (match) {
      filename = `${match[1]}${match[2]}`;
    }

    const parts = filename.split(".");
    const extension = parts.length > 1 ? parts.pop()!.toUpperCase() : "FILE";

    return { name: filename, extension };
  } catch {
    return { name: "attachment_file", extension: "FILE" };
  }
}

/**
 * Parses RFQ description to separate human-readable text from attachment metadata.
 * Supports legacy format "Attachment: http..." as well as markdown "[name](url)".
 */
export function parseDescriptionAndAttachment(rawDescription?: string | null): ParsedRFQDescription {
  if (!rawDescription || !rawDescription.trim()) {
    return { cleanDescription: "", attachment: null };
  }

  // 1. Check for Markdown link format: Attachment: [name](url) or [name](url)
  const mdRegex = /(?:Attachment:\s*)?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i;
  const mdMatch = rawDescription.match(mdRegex);
  if (mdMatch) {
    const name = mdMatch[1].trim();
    const url = mdMatch[2].trim();
    const extParts = name.split(".");
    const extension = extParts.length > 1 ? extParts.pop()!.toUpperCase() : "FILE";
    const cleanDescription = rawDescription.replace(mdMatch[0], "").trim();

    return {
      cleanDescription,
      attachment: {
        name,
        url,
        extension,
      },
    };
  }

  // 2. Check for plain URL format: Attachment: https?://...
  const plainUrlRegex = /Attachment:\s*(https?:\/\/[^\s]+)/i;
  const urlMatch = rawDescription.match(plainUrlRegex);
  if (urlMatch) {
    const url = urlMatch[1].trim();
    const { name, extension } = extractCleanFilename(url);
    const cleanDescription = rawDescription.replace(urlMatch[0], "").trim();

    return {
      cleanDescription,
      attachment: {
        name,
        url,
        extension,
      },
    };
  }

  // 3. Fallback: Check if description ends with a raw http/https URL that looks like a file
  const trailingUrlRegex = /(https?:\/\/[^\s]+\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|zip|csv))$/i;
  const trailingMatch = rawDescription.match(trailingUrlRegex);
  if (trailingMatch) {
    const url = trailingMatch[1].trim();
    const { name, extension } = extractCleanFilename(url);
    const cleanDescription = rawDescription.replace(trailingMatch[0], "").trim();

    return {
      cleanDescription,
      attachment: {
        name,
        url,
        extension,
      },
    };
  }

  return {
    cleanDescription: rawDescription.trim(),
    attachment: null,
  };
}

/**
 * Combines clean description text and attachment into standardized description format.
 */
export function formatDescriptionWithAttachment(
  description: string,
  attachment: { name: string; url: string } | null
): string {
  const cleanDesc = description.trim();
  if (!attachment || !attachment.url) {
    return cleanDesc;
  }

  const attachmentMd = `Attachment: [${attachment.name}](${attachment.url})`;
  return cleanDesc ? `${cleanDesc}\n\n${attachmentMd}` : attachmentMd;
}

/**
 * Triggers a direct file download for an attachment URL.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    // If blob fetch fails (e.g. cross-origin restrictions), open/download directly
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
