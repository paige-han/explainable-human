# 2022 — as exhibited

The server code exactly as it ran at Gallery Jiha (Nov 2022), with one change: **API keys were replaced by environment-variable lookups** before publishing.

- `server.js` — Express server: 14 JSON logging routes, GPT-3 `text-davinci-002` completion for sentence expansion and colour → HEX, Naver Papago translation.
- `aifunction.py` — early Python prototype of the same two prompts (later moved into Node).

This code no longer runs as-is: `text-davinci-002` is retired and the `openai@3` SDK is deprecated. Use `../../app` instead.
