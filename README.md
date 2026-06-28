# Tech content
You may watch the informational [tech content in Meta](https://web.facebook.com/reel/1021512850352992) or download the `informationalReindexArchiveSessionsForCodex.mp4` instead. The audio is in Filipino with English subs.


# Reindex Archive Sessions for Codex

> **Sustainability reminder:** This indexer reads Codex rollout JSONL files, whose internal structure may evolve as Codex is updated by OpenAI, a product ultimately owned and maintained by Kuya Sam and company. The parser is intentionally tolerant of unfamiliar properties and unrelated event types, so ordinary additions should not require any changes. However, the rollout format is not treated here as a permanently stable public contract. From time to time, preferably once a month or after a major Codex update, manually compare a recent raw `.jsonl` file with the fields expected by `index.js`. Check whether conversation event names, speaker roles, timestamps, message fields, attachment references, or turn identifiers have changed. If the structure remains compatible, leave the script as-is. A quick manual review is still better than discovering months later that a silent product change produced an incomplete index. In short: sustainable, yes; maintenance-free forever, no. Kuya Sam may rearrange the furniture.

Converts every Codex rollout `.jsonl` below an input directory into one chronological `codexIndex.csv`. It keeps visible user and assistant exchanges, timestamps, session and turn IDs, assistant message phases, shared URLs, and attachment filenames.

## Requirements

- Human `opo, kailangan po ng tao na gagamit nito hindi po puro AI`
- Node.js 18 or newer `libre yan bes  para sa mac, windows or linux`
- No npm dependencies `pinadali ko na para sa iyo`

## Configure

Open `index.js` and edit the three values at the top:

```js
const SETTINGS = {
  inputDirectory: "C:\\users\\pangalanMoTe\\Downloads\\rolloutFiles",
  userName: "pangalanMoPoOpo",
  assistantName: "pangalanNgCodexAgentMoYes",
};
```

***The above are just samples, wag gullible bes***

Change only those values whenever needed. For example, use `juan`, `pedro`, `maria`, `palad`; the parser itself needs no modification.

## Run

From this repository, run:

```powershell or bash
node index.js
```

The script parses every `.jsonl` in the configured folder and its subfolders, then writes `codexIndex.csv` beside `index.js`. An existing CSV is replaced completely.

## CSV Columns

- `timestamp`: exact ISO timestamp from the rollout
- `sessionId`: Codex session identifier
- `turnId`: Codex turn identifier active for the exchange
- `speaker`: configurable display name
- `role`: stable `user` or `assistant` value
- `phase`: assistant phase such as `commentary` or `final_answer`
- `message`: full visible message, including line breaks
- `fileNames`: attachment names separated by ` | `
- `urls`: URLs found in the message, separated by ` | `
- `sourceFile`: original rollout filename

Internally duplicated `response_item/message` records are intentionally ignored. The index uses the visible `event_msg` conversation stream so messages appear once and injected runtime instructions do not pollute the CSV.

## Test

```powershell or bash
npm test
```
