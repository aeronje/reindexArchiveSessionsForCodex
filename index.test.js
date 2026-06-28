import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildIndex } from "./index.js";

test("builds a chronological CSV with names, URLs, and attachment filenames", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-index-"));
  const input = join(root, "rollouts");
  const output = join(root, "output");
  mkdirSync(input);
  mkdirSync(output);

  const records = [
    { type: "session_meta", payload: { session_id: "session-1" } },
    { type: "turn_context", payload: { turn_id: "turn-1" } },
    {
      timestamp: "2026-06-28T01:00:00.000Z",
      type: "event_msg",
      payload: {
        type: "user_message",
        message: "See https://example.com/file and screenshot.",
        images: [],
        local_images: ["C:\\Temp\\screen.png"],
      },
    },
    {
      timestamp: "2026-06-28T01:00:01.000Z",
      type: "event_msg",
      payload: { type: "agent_message", phase: "final_answer", message: "Got it, Pogi." },
    },
    {
      timestamp: "2026-06-28T01:00:02.000Z",
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "duplicate" }] },
    },
  ];
  writeFileSync(join(input, "rollout.jsonl"), records.map(JSON.stringify).join("\n"));

  const result = await buildIndex({
    inputDirectory: input,
    userName: "pogi",
    assistantName: "donnaPaulsen",
  }, output);
  const csv = readFileSync(result.outputPath, "utf8");

  assert.equal(result.rowCount, 2);
  assert.match(csv, /"pogi","user"/);
  assert.match(csv, /"donnaPaulsen","assistant","final_answer"/);
  assert.match(csv, /"screen\.png"/);
  assert.match(csv, /"https:\/\/example\.com\/file"/);
  assert.doesNotMatch(csv, /duplicate/);
});

test("overwrites an existing codexIndex.csv", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-index-overwrite-"));
  const input = join(root, "rollouts");
  mkdirSync(input);
  writeFileSync(join(root, "codexIndex.csv"), "stale data");
  writeFileSync(join(input, "rollout.jsonl"), [
    JSON.stringify({ type: "session_meta", payload: { session_id: "session-2" } }),
    JSON.stringify({
      timestamp: "2026-06-28T02:00:00.000Z",
      type: "event_msg",
      payload: { type: "user_message", message: "fresh data", images: [], local_images: [] },
    }),
  ].join("\n"));

  await buildIndex({ inputDirectory: input, userName: "juan", assistantName: "bot" }, root);
  const csv = readFileSync(join(root, "codexIndex.csv"), "utf8");
  assert.match(csv, /fresh data/);
  assert.doesNotMatch(csv, /stale data/);
});
