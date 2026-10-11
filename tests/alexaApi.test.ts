import assert from "node:assert/strict";
import { test } from "node:test";
import { createAcademicApiClient } from "../server/academicApiClient.js";
import account from "../api/alexa-account.js";
import progress from "../api/alexa-progress.js";
import schedule from "../api/alexa-schedule.js";
import status from "../api/alexa-academic-status.js";
import grades from "../api/alexa-grades.js";

const endpoints = [account, progress, schedule, status, grades];

test("all Alexa routes reject unauthenticated reads and writes before accessing storage", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("Unauthenticated request reached an upstream service."); };
    try {
        for (const api of endpoints) {
            assert.equal((await api.fetch(new Request("https://example.com/api"))).status, 401);
            assert.equal((await api.fetch(new Request("https://example.com/api", { method: "OPTIONS" }))).status, 204);
            assert.equal((await api.fetch(new Request("https://example.com/api", { method: "DELETE" }))).status, 405);
        }
        assert.equal((await grades.fetch(new Request("https://example.com/api", { method: "POST" }))).status, 401);
    } finally { globalThis.fetch = original; }
});

test("verified Supabase ownership is bound to each client; other UIDs never reach storage", async () => {
    const original = globalThis.fetch;
    const saved = { ...process.env };
    process.env.SUPABASE_URL = "https://kdyjjbzahmyhbmuwrwzr.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "synthetic-test-key";
    process.env.ALEXA_DATA_PROVIDER = "supabase";
    let reads = 0;
    globalThis.fetch = async input => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        if (url.pathname === "/auth/v1/user") return Response.json({ id: "owner", email: "synthetic@example.com" });
        assert.equal(url.searchParams.get("user_id"), "eq.owner");
        reads++;
        return Response.json({ academic_data: { marker: "owner" }, schema_version: 1, updated_at: "2026-10-10T00:00:00Z" });
    };
    try {
        const client = createAcademicApiClient("verified-test-token")!;
        assert.ok((await client.getSnapshot("owner")).error);
        assert.equal(reads, 0);
        assert.equal((await client.auth.getUser("verified-test-token")).data.user?.id, "owner");
        assert.ok((await client.getSnapshot("other")).error);
        assert.ok((await client.saveSnapshot("other", {}, { academic_data: {}, schema_version: 1, updated_at: "" })).error);
        assert.equal(reads, 0);
        assert.equal((await client.getSnapshot("owner")).snapshot?.academic_data.marker, "owner");
        assert.equal(reads, 1);
        // Trying a different token clears the previously verified identity.
        assert.equal((await client.auth.getUser("different-token")).data.user, null);
        assert.ok((await client.getSnapshot("owner")).error);
        assert.equal(reads, 1);
    } finally { globalThis.fetch = original; process.env = saved; }
});

test("invalid tokens cannot read Alexa data, and invalid provider configuration fails closed", async () => {
    const original = globalThis.fetch;
    const saved = { ...process.env };
    process.env.SUPABASE_URL = "https://kdyjjbzahmyhbmuwrwzr.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "synthetic-test-key";
    process.env.ALEXA_DATA_PROVIDER = "supabase";
    globalThis.fetch = async input => {
        assert.ok(String(input).includes("/auth/v1/user"));
        return Response.json({ message: "Invalid JWT", error_code: "bad_jwt" }, { status: 401 });
    };
    try {
        for (const api of endpoints) assert.equal((await api.fetch(new Request("https://example.com/api", { headers: { Authorization: "Bearer invalid" } }))).status, 401);
        process.env.ALEXA_DATA_PROVIDER = "unknown";
        assert.throws(() => createAcademicApiClient("token"));
    } finally { globalThis.fetch = original; process.env = saved; }
});
