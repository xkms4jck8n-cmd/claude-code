#!/usr/bin/env node
// QA validator for BrainKingdom.tsx — question bank integrity, duplicate &
// similarity detection, puzzle diversity, and content-shape checks.
// Usage: node brainkingdom.qa.mjs   (requires bun on PATH to transpile the tsx)
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const TSX = path.join(ROOT, "BrainKingdom.tsx");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bkqa-"));
const js = path.join(tmp, "bk.js");
execSync(`bun build ${TSX} --no-bundle --outfile=${js}`, { stdio: "pipe" });

// stub react + jsx so module-level data evaluates under plain node
let src = fs.readFileSync(js, "utf8")
  .replace(/^import[^\n]*react[^\n]*$/gmi, "")
  .replace(/export default/g, "const __default =");
const stub = `const React={useState:()=>[null,()=>{}],useEffect:()=>{},useRef:(v)=>({current:v}),useMemo:(f)=>f(),useCallback:(f)=>f,Fragment:"f",createElement:()=>null};
const useState=React.useState,useEffect=React.useEffect,useRef=React.useRef,useMemo=React.useMemo,useCallback=React.useCallback;
const jsxDEV=()=>null,jsx=()=>null,jsxs=()=>null;\n`;
const harness = `\nfs_out(JSON.stringify({
  BANK: Object.fromEntries(Object.entries(BANK).map(([k,v])=>[k,v.map(q=>({q:q.q,a:q.a,opts:q.opts,d:q.d}))])),
  CATEGORIES: CATEGORIES.map(c=>c.id),
  MODES: MODES.map(m=>m.id),
  CASES: CASES.map(c=>({id:c.id,title:c.title,answer:c.answer,suspects:c.suspects.map(s=>s.name),clues:c.clues.length})),
  ROOMS: ESCAPE_ROOMS.map(r=>({id:r.id,title:r.title,puzzles:r.puzzles.map(p=>({kind:p.kind,needs:p.needs,reward:p.reward,prompt:p.prompt}))})),
  ERAS: TT_ERAS.map(e=>({id:e.id,name:e.name})),
  FREE: ESCAPE_FREE,
}));`;
fs.writeFileSync(path.join(tmp, "run.cjs"),
  `const fs=require("fs");const fs_out=(s)=>fs.writeFileSync(${JSON.stringify(path.join(tmp, "data.json"))},s);\n` + stub + src + harness);
execSync(`node ${path.join(tmp, "run.cjs")}`, { stdio: "pipe" });
const D = JSON.parse(fs.readFileSync(path.join(tmp, "data.json"), "utf8"));

const normAr = (s) => String(s).replace(/[ً-ْٰ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[؟?.،,!:؛\-…()«»"']/g, "").replace(/\s+/g, " ").trim();

let failures = 0;
const ok = (cond, label) => { console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${label}`); if (!cond) failures++; };

console.log("== Question bank ==");
let total = 0;
for (const cat of D.CATEGORIES) {
  const qs = D.BANK[cat] || [];
  total += qs.length;
  const seen = new Set(); let dups = 0, badOpts = 0, diffs = new Set();
  for (const q of qs) {
    const k = normAr(q.q);
    if (seen.has(k)) dups++; seen.add(k);
    if (!Array.isArray(q.opts) || q.opts.length !== 4 || !q.opts.includes(q.a) || new Set(q.opts.map(normAr)).size !== 4) badOpts++;
    diffs.add(q.d);
  }
  ok(qs.length >= 450, `${cat}: ${qs.length} questions (≥450)`);
  ok(dups === 0, `${cat}: no exact duplicates (${dups})`);
  ok(badOpts === 0, `${cat}: all options valid — 4 unique, answer included (${badOpts} bad)`);
  ok(diffs.size === 5, `${cat}: covers all 5 difficulty tiers`);
}
console.log(`  TOTAL: ${total} questions across ${D.CATEGORIES.length} categories`);

console.log("== Detective cases ==");
ok(new Set(D.CASES.map(c => c.title)).size === D.CASES.length, `unique case titles (${D.CASES.length})`);
for (const c of D.CASES) {
  ok(c.suspects.includes(c.answer), `case «${c.title}»: culprit is one of the suspects`);
  ok(c.suspects.length === 4 && c.clues >= 4, `case «${c.title}»: 4 suspects & ≥4 clues`);
}

console.log("== Escape rooms ==");
const promptSeen = new Set();
for (const r of D.ROOMS) {
  ok(r.puzzles.length === 5, `room «${r.title}»: exactly 5 puzzles`);
  ok(r.puzzles[0].needs == null, `room «${r.title}»: first puzzle unlocked`);
  let chain = true;
  for (let i = 0; i < 4; i++) if (r.puzzles[i + 1].needs && r.puzzles[i].reward !== r.puzzles[i + 1].needs) chain = false;
  ok(chain, `room «${r.title}»: reward→needs chain is consistent`);
  const kinds = r.puzzles.map(p => p.kind);
  ok(new Set(kinds).size === kinds.length, `room «${r.title}»: 5 distinct puzzle mechanics (${kinds.join(",")})`);
  let dupPrompt = false;
  for (const p of r.puzzles) { const k = normAr(p.prompt); if (promptSeen.has(k)) dupPrompt = true; promptSeen.add(k); }
  ok(!dupPrompt, `room «${r.title}»: no prompt duplicated across rooms`);
}

console.log("== Time-travel eras ==");
ok(D.ERAS.length === 13, `13 eras (${D.ERAS.length})`);
ok(new Set(D.ERAS.map(e => e.name)).size === D.ERAS.length, "unique era names");

console.log("== Modes ==");
ok(D.MODES.length === 11, `11 game modes (${D.MODES.join(", ")})`);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? "\nQA PASSED — no failures." : `\nQA FAILED — ${failures} issue(s).`);
process.exit(failures === 0 ? 0 : 1);
