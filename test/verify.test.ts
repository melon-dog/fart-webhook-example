import { describe, expect, it } from "vitest";
import { isFreshTimestamp, verifyFartSignature } from "../src/verify";

const encoder = new TextEncoder();
const SECRET = "whsec_test";

async function sign(secret: string, timestamp: string, body: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = new Uint8Array(
        await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`))
    );
    return `sha256=${[...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

describe("verifyFartSignature", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ hello: "world" });

    it("accepts a valid signature", async () => {
        const signature = await sign(SECRET, timestamp, body);

        await expect(
            verifyFartSignature(SECRET, timestamp, body, signature)
        ).resolves.toBe(true);
    });

    it("rejects a different secret", async () => {
        const signature = await sign("whsec_other", timestamp, body);

        await expect(
            verifyFartSignature(SECRET, timestamp, body, signature)
        ).resolves.toBe(false);
    });

    it("rejects a different body", async () => {
        const signature = await sign(SECRET, timestamp, body);

        await expect(
            verifyFartSignature(SECRET, timestamp, `${body} `, signature)
        ).resolves.toBe(false);
    });

    it("rejects malformed signatures", async () => {
        await expect(
            verifyFartSignature(SECRET, timestamp, body, "sha256=zz")
        ).resolves.toBe(false);
        await expect(
            verifyFartSignature(SECRET, timestamp, body, "sha256=00")
        ).resolves.toBe(false);
        await expect(
            verifyFartSignature(SECRET, timestamp, body, "nope")
        ).resolves.toBe(false);
    });
});

describe("isFreshTimestamp", () => {
    it("accepts the current timestamp", () => {
        expect(isFreshTimestamp(String(Math.floor(Date.now() / 1000)))).toBe(true);
    });

    it("rejects old timestamps", () => {
        expect(
            isFreshTimestamp(String(Math.floor(Date.now() / 1000) - 3600))
        ).toBe(false);
    });

    it("rejects invalid values", () => {
        expect(isFreshTimestamp("nope")).toBe(false);
    });
});
