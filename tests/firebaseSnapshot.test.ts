import assert from "node:assert/strict";
import test from "node:test";
import { decodeFirebaseSnapshot, encodeFirebaseSnapshot, MAX_SNAPSHOT_BYTES } from "../src/utils/firebaseSnapshot.js";

test("Firebase preserves academic JSON, nested arrays, Unicode and storage keys", () => {
    const data = JSON.parse('{"pensum:grades.v2":{"Calculo":4.2,"cortes":[[1,2],[3,null]]},"horario":{"salón":"José María","classes":[]},"__proto__":{"safe":true}}');
    assert.deepEqual(decodeFirebaseSnapshot(encodeFirebaseSnapshot(data), 2), data);
    assert.equal(Object.hasOwn(data, "__proto__"), true);
});

test("legacy map snapshots remain readable", () => {
    assert.deepEqual(decodeFirebaseSnapshot({ grades: [4, 5] }, 1), { grades: [4, 5] });
});

test("invalid or unknown cloud snapshots cannot hydrate local storage", () => {
    for (const [value, version] of [[null, 2], [[], 1], [{ payload: "[]" }, 2], [{ payload: "null" }, 2], [{ payload: "{}" }, 3], [{ payload: "{" }, 2]]) {
        assert.throws(() => decodeFirebaseSnapshot(value, version));
    }
});

test("size guard counts UTF-8 bytes before a remote write", () => {
    assert.throws(() => encodeFirebaseSnapshot({ notes: "á".repeat(MAX_SNAPSHOT_BYTES / 2) }));
    assert.doesNotThrow(() => encodeFirebaseSnapshot({ notes: "a".repeat(1000) }));
});
