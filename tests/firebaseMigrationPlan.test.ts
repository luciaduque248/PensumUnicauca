import assert from "node:assert/strict";
import test from "node:test";
import { prepareFirebaseMigration } from "../scripts/firebaseMigrationPlan.js";

const uid = "00000000-0000-4000-8000-000000000001";
const fixture = () => ({
    source_project: "kdyjjbzahmyhbmuwrwzr", target_project: "mi-pensum-unicauca",
    exported_at: "2026-10-10T23:00:00Z", other_provider_identities: 0, mfa_factors: 0,
    users: [{ id: uid, email: "student@example.com", encrypted_password: "$2a$10$" + "a".repeat(53),
        created_at: "2026-01-01T00:00:00Z", email_confirmed_at: "2026-01-02T00:00:00Z",
        last_sign_in_at: null, deleted_at: null, banned_until: null, is_anonymous: false }],
    snapshots: [{ user_id: uid, schema_version: 1, academic_data: { grades: [[4.2, null]], room: "José" }, updated_at: "2026-10-10T22:00:00Z" }],
});

test("migration preserves UID, bcrypt bytes, verified email and academic JSON", () => {
    const source = fixture();
    const result = prepareFirebaseMigration(source, { users: [] });
    assert.equal(result.authImport.users[0].localId, uid);
    assert.equal(Buffer.from(result.authImport.users[0].passwordHash, "base64").toString("utf8"), source.users[0].encrypted_password);
    assert.equal(result.authImport.users[0].emailVerified, true);
    assert.equal(result.firestoreDocuments[0].path, `academic_snapshots/${uid}`);
    assert.deepEqual(JSON.parse(result.firestoreDocuments[0].data.academic_data.payload), source.snapshots[0].academic_data);
    assert.equal(result.firestoreDocuments[0].data.updated_at, "2026-10-10T22:00:00.000Z");
});

test("migration refuses Firebase UID or email collisions and duplicate source accounts", () => {
    assert.throws(() => prepareFirebaseMigration(fixture(), { users: [{ localId: uid }] }));
    assert.throws(() => prepareFirebaseMigration(fixture(), { users: [{ localId: "other", email: "STUDENT@example.com" }] }));
    const source = fixture(); source.users.push({ ...source.users[0] });
    assert.throws(() => prepareFirebaseMigration(source, { users: [] }));
});

test("migration refuses unsupported auth and orphan snapshots", () => {
    assert.throws(() => prepareFirebaseMigration({ ...fixture(), mfa_factors: 1 }, { users: [] }));
    const source = fixture(); source.snapshots[0].user_id = "orphan";
    assert.throws(() => prepareFirebaseMigration(source, { users: [] }));
    source.snapshots[0].user_id = uid; source.users[0].encrypted_password = "not-a-bcrypt-hash";
    assert.throws(() => prepareFirebaseMigration(source, { users: [] }));
});

test("migration preserves bans and refuses invalid cloud dates", () => {
    const source = { ...fixture(), users: [{ ...fixture().users[0], banned_until: "2099-01-01T00:00:00Z" }] };
    assert.equal(prepareFirebaseMigration(source, { users: [] }).authImport.users[0].disabled, true);
    assert.throws(() => prepareFirebaseMigration({ ...fixture(), exported_at: "invalid" }, { users: [] }));
});
