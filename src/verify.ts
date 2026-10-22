/**
 * Fart Noises webhook signature verification.
 *
 * Fart signs `${timestamp}.${rawBody}` with HMAC-SHA256 and sends:
 *   X-Fart-Signature: sha256=<hex>
 *   X-Fart-Timestamp: <unix seconds>
 */

const encoder = new TextEncoder();
const SIGNATURE_PREFIX = "sha256=";
const MAX_SKEW_SECONDS = 300;

/** Rejects timestamps older than 5 minutes (or too far in the future). */
export function isFreshTimestamp(
    timestamp: string,
    skewSeconds = MAX_SKEW_SECONDS
): boolean {
    const seconds = Number(timestamp);
    if (!Number.isFinite(seconds)) return false;

    return Math.abs(Date.now() / 1000 - seconds) <= skewSeconds;
}

function hexToBytes(hex: string): Uint8Array | null {
    if (hex.length === 0 || hex.length % 2 !== 0) return null;
    if (!/^[0-9a-f]+$/i.test(hex)) return null;

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/** Verifies the HMAC without comparing strings manually. */
export async function verifyFartSignature(
    secret: string,
    timestamp: string,
    rawBody: string,
    signatureHeader: string
): Promise<boolean> {
    if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

    const signature = hexToBytes(signatureHeader.slice(SIGNATURE_PREFIX.length));
    if (!signature) return false;

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );

    return crypto.subtle.verify(
        "HMAC",
        key,
        signature,
        encoder.encode(`${timestamp}.${rawBody}`)
    );
}
