/**
 * Minimal Fart Noises webhook receiver.
 *
 * POST /webhook → verify the signature and log the payload
 * GET  /health  → JSON status
 *
 * Configure the endpoint in Fart Noises → Settings → Developers. This Worker
 * only receives notifications; no custom frontend is needed.
 */

import { isFreshTimestamp, verifyFartSignature } from "./verify";

interface Env {
    FART_WEBHOOK_SECRET?: string;
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
    const rawBody = await request.text();

    // Fart's initial connection check is unsigned because the secret is
    // generated together with the webhook.
    if (request.headers.get("x-fart-test") === "1") {
        console.log("Fart connection check received");
        return new Response(null, { status: 204 });
    }

    const secret = env.FART_WEBHOOK_SECRET;
    if (!secret) {
        return new Response("FART_WEBHOOK_SECRET is not configured", { status: 503 });
    }

    const timestamp = request.headers.get("x-fart-timestamp");
    const signature = request.headers.get("x-fart-signature");
    if (!timestamp || !signature) {
        return new Response("Missing X-Fart-Timestamp or X-Fart-Signature", { status: 401 });
    }

    if (!isFreshTimestamp(timestamp)) {
        return new Response("Stale or invalid timestamp", { status: 401 });
    }

    if (!(await verifyFartSignature(secret, timestamp, rawBody, signature))) {
        return new Response("Invalid signature", { status: 401 });
    }

    let payload: unknown;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return new Response("Invalid JSON body", { status: 400 });
    }

    const body = payload as { type?: string; id?: string };
    console.log(JSON.stringify({
        event: request.headers.get("x-fart-event"),
        delivery: request.headers.get("x-fart-delivery"),
        type: body.type,
        id: body.id,
        payload,
    }, null, 2));

    return new Response(null, { status: 204 });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "GET" && url.pathname === "/health") {
            return Response.json({
                ok: true,
                secretConfigured: Boolean(env.FART_WEBHOOK_SECRET),
            });
        }

        if (
            request.method === "POST" &&
            (url.pathname === "/webhook" || url.pathname === "/")
        ) {
            return handleWebhook(request, env);
        }

        return new Response("Not found", { status: 404 });
    },
};
