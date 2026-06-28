#!/usr/bin/env node
// I write in tagalog mostly so comments are expected in tagalog, para sa bayan. Oh yeah!
// Ron Penones - June 28th 2026

import { createReadStream, existsSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const OUTPUT_NAME = "codexIndex.csv";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// Edit only these three values for your own Codex archive and speaker names.
const SETTINGS = {
  inputDirectory: "C:\\users\\aeronje\\Downloads\\rolloutFiles", // Hello po, iyong naka-double quotes paki-palitan po kung saan located ang lahat ng .jsonl files niyo sa codex. I would suggest pagsamasamahin niyo na lahat by creating a new copy para isang bagsakan na lang.
  userName: "pogi", // Iyong naka-double quotes, pangalan na gusto mo lumabas mamaya sa spreadsheet, iyong pangalan niyo po. Yes pangalan po ng tao. Pogi talaga ako kaya pangalan ko Pogi.
  assistantName: "donna", // Iyong naka-double quotes, wala akong jowa na donna ang name, ok?, pangalan lang iyan ng bot/coding agent or AI mo, kung gusto mo lagay mo pangalan muning, chuchu or brownie bahala ka!
};

const CSV_COLUMNS = [
  "timestamp",
  "sessionId",
  "turnId",
  "speaker",
  "role",
  "phase",
  "message",
  "fileNames",
  "urls",
  "sourceFile",
];

function findJsonlFiles(root) {
  const results = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jsonl")) {
        results.push(fullPath);
      }
    }
  };
  visit(root);
  return results.sort((left, right) => left.localeCompare(right));
}

function fileNameFromReference(value) {
  if (typeof value !== "string" || value.startsWith("data:")) return null;
  const withoutQuery = value.split(/[?#]/, 1)[0];
  const normalized = withoutQuery.replaceAll("\\", "/");
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(name) || null;
  } catch {
    return name || null;
  }
}

function extractFileNames(payload) {
  const names = new Set();
  for (const value of [...(payload.images ?? []), ...(payload.local_images ?? [])]) {
    const reference = typeof value === "string"
      ? value
      : value?.path ?? value?.image_url ?? value?.url ?? value?.name;
    const name = fileNameFromReference(reference);
    if (name) names.add(name);
  }

  const message = payload.message ?? "";
  const mentionedFilePattern = /^##\s+([^\r\n:]+\.[a-z0-9]{1,16}):\s+(?:[a-z]:[\\/]|\/|https?:\/\/).+$/gim;
  for (const match of message.matchAll(mentionedFilePattern)) {
    names.add(match[1].trim());
  }
  return [...names];
}

function extractUrls(text) {
  const urls = new Set();
  const pattern = /https?:\/\/[^\s<>"']+/giu;
  for (const match of text.matchAll(pattern)) {
    let url = match[0];
    while (/[.,;:!?]$/.test(url)) url = url.slice(0, -1);
    const unmatchedClosingParenthesis = url.endsWith(")")
      && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0);
    if (unmatchedClosingParenthesis) url = url.slice(0, -1);
    urls.add(url);
  }
  return [...urls];
}

async function parseRollout(path, config, sourceOrder) {
  const rows = [];
  let sessionId = "";
  let activeTurnId = "";
  let lineNumber = 0;
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`${basename(path)}:${lineNumber}: invalid JSON (${error.message})`);
    }

    if (record.type === "session_meta") {
      sessionId = record.payload?.session_id ?? record.payload?.id ?? sessionId;
      continue;
    }
    if (record.type === "turn_context") {
      activeTurnId = record.payload?.turn_id ?? activeTurnId;
      continue;
    }
    if (record.type !== "event_msg") continue;

    const payload = record.payload ?? {};
    const isUser = payload.type === "user_message";
    const isAssistant = payload.type === "agent_message";
    if (!isUser && !isAssistant) continue;

    const message = payload.message ?? "";
    rows.push({
      timestamp: record.timestamp ?? "",
      sessionId,
      turnId: activeTurnId,
      speaker: isUser ? config.userName : config.assistantName,
      role: isUser ? "user" : "assistant",
      phase: isAssistant ? payload.phase ?? "" : "",
      message,
      fileNames: extractFileNames(payload).join(" | "),
      urls: extractUrls(message).join(" | "),
      sourceFile: basename(path),
      sourceOrder,
      lineNumber,
    });
  }
  return rows;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function serializeCsv(rows) {
  const lines = [CSV_COLUMNS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function replaceOutput(path, contents) {
  const temporaryPath = `${path}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, contents, "utf8");
  try {
    renameSync(temporaryPath, path);
  } catch (error) {
    if (process.platform !== "win32" || !existsSync(path)) throw error;
    rmSync(path, { force: true });
    renameSync(temporaryPath, path);
  }
}

export async function buildIndex(config, outputDirectory = process.cwd()) {
  if (!existsSync(config.inputDirectory) || !statSync(config.inputDirectory).isDirectory()) {
    throw new Error(`Input directory not found: ${config.inputDirectory}`);
  }

  const files = findJsonlFiles(config.inputDirectory);
  if (files.length === 0) {
    throw new Error(`No .jsonl files found under: ${config.inputDirectory}`);
  }

  const groups = await Promise.all(
    files.map((path, index) => parseRollout(path, config, index)),
  );
  const rows = groups.flat().sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp)
      || left.sourceOrder - right.sourceOrder
      || left.lineNumber - right.lineNumber,
  );
  const outputPath = resolve(outputDirectory, OUTPUT_NAME);
  replaceOutput(outputPath, serializeCsv(rows));
  return { outputPath, fileCount: files.length, rowCount: rows.length };
}

async function main() {
  const result = await buildIndex(SETTINGS, SCRIPT_DIR);
  console.log(`Indexed ${result.rowCount} exchanges from ${result.fileCount} rollout files.`);
  console.log(`Wrote ${result.outputPath}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
