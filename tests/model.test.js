import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  coverage,
  draftDefinitions,
  eligible,
  nextReview,
  validateBackup,
  currentSessionCard,
} from "../src/model";
import { db, initialize, inspectImport, importBackup, approveDrafts, rebuildLegacyDrafts } from "../src/db";
const p = {
  id: "d:1",
  documentId: "d",
  number: 1,
  text: "Example term: An illustrative definition for testing.",
  status: "extracted",
  error: "",
  reviewed: false,
  updatedAt: 1,
};
const card = { ...draftDefinitions(p, "s")[0], updatedAt: 1 };
const pack = () => ({
  format: "medimate",
  version: 1,
  tables: {
    subjects: [{ id: "s", name: "Test", updatedAt: 1 }],
    documents: [
      {
        id: "d",
        subjectId: "s",
        name: "Test.pdf",
        total: 2,
        hash: "hash",
        updatedAt: 1,
      },
    ],
    pages: [p],
    cards: [card],
    attempts: [],
    settings: [],
  },
  files: [],
});
describe("source integrity and review", () => {
  it('rejects cached session cards after edits, deletion, or verification changes',()=>{
    const snapshot={...card,verified:true};
    expect(currentSessionCard(snapshot,[snapshot],[p])).toEqual(snapshot);
    expect(currentSessionCard(snapshot,[{...snapshot,prompt:'A corrected question'}],[p])).toBeNull();
    expect(currentSessionCard(snapshot,[{...snapshot,verified:false}],[p])).toBeNull();
    expect(currentSessionCard(snapshot,[],[p])).toBeNull();
  });
  it("separates attempted pages from successful extraction", () => {
    expect(coverage([p, { ...p, status: "failed" }], 5)).toEqual({
      attempted: 2,
      extracted: 1,
      flagged: 1,
      remaining: 3,
    });
  });
  it("creates unverified drafts with exact page provenance", () => {
    expect(card.verified).toBe(false);
    expect(card.quote).toBe(p.text);
    expect(card.answer).toContain("illustrative");
    expect(eligible(card, [p])).toBe(false);
    expect(eligible({ ...card, verified: true }, [p])).toBe(true);
    expect(eligible({ ...card, verified: true, quote: "invented" }, [p])).toBe(
      false,
    );
  });
  it("schedules missed cards in ten minutes and remembered cards at increasing intervals", () => {
    expect(nextReview({ ...card, interval: 0 }, false, 100).due).toBe(600100);
    expect(nextReview({ ...card, interval: 2 }, true, 100).interval).toBe(4);
  });
  it("rejects missing source pages, invalid choices and duplicate rows", () => {
    const a = pack();
    a.tables.pages = [];
    expect(() => validateBackup(a)).toThrow();
    const b = pack();
    b.tables.cards = [{ ...card, options: ["wrong", "also wrong"] }];
    expect(() => validateBackup(b)).toThrow();
    const c = pack();
    c.tables.subjects.push(c.tables.subjects[0]);
    expect(() => validateBackup(c)).toThrow();
  });
});
describe("database import atomicity", () => {
  it('flags ambiguous older keywords and prevents bulk approval after rebuilding',async()=>{
    await importBackup(pack());
    await db.cards.clear();
    await db.pages.put({...p,text:'Primary Diseases:\n● Males: example symptoms.'});
    const old={...card,id:'draft-d:1-1',quote:'● Males: example symptoms.',prompt:'What is ● Males?',generationVersion:undefined,verified:true};
    await db.cards.put(old);
    expect(await rebuildLegacyDrafts()).toEqual({rewritten:0,flagged:1});
    expect((await db.cards.get(old.id)).needsContext).toBe(true);
    expect(await approveDrafts([old.id])).toEqual({approved:0,skipped:1});
  });
  it('rebuilds old drafts without losing their earlier wording and requires fresh review',async()=>{
    await importBackup(pack());
    const old={...card,prompt:'What is Example term?',answer:'Truncated answer',generationVersion:undefined,verified:true};
    await db.cards.put(old);
    expect(await approveDrafts([old.id])).toEqual({approved:0,skipped:1});
    expect(await rebuildLegacyDrafts()).toEqual({rewritten:1,flagged:0});
    const rebuilt=await db.cards.get(old.id);expect(rebuilt.verified).toBe(false);expect(rebuilt.previousDraft.answer).toBe('Truncated answer');expect(rebuilt.prompt).toContain('what does the trans state'.replace('what','What'));expect(rebuilt.answer).toBe(card.answer);
  });
  it("bulk approves valid drafts, skips broken sources, and preserves verified items", async () => {
    await importBackup(pack());
    await db.cards.bulkPut([
      {...card, id:'broken', quote:'Not in source'},
      {...card, id:'verified', verified:true, verifiedAt:12},
      {...card, id:'bad-choices', kind:'question', options:['Only one']},
    ]);
    expect(await approveDrafts([card.id, card.id, 'broken', 'verified', 'bad-choices'])).toEqual({approved:1, skipped:2});
    expect((await db.cards.get(card.id)).verified).toBe(true);
    expect((await db.cards.get('broken')).verified).toBe(false);
    expect((await db.cards.get('verified')).verifiedAt).toBe(12);
    expect(await approveDrafts([card.id])).toEqual({approved:0, skipped:0});
  });
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });
  it("initializes once and preserves personalization", async () => {
    await initialize();
    await db.settings.update("profile", { name: "Ada" });
    await initialize();
    expect(await db.subjects.count()).toBe(6);
    expect((await db.settings.get("profile")).name).toBe("Ada");
  });
  it("roundtrips a backup and preserves existing local conflicts", async () => {
    await importBackup(pack());
    const changed = pack();
    changed.tables.subjects[0].name = "Incoming";
    expect((await inspectImport(changed)).conflicts).toHaveLength(1);
    await importBackup(changed);
    expect((await db.subjects.get("s")).name).toBe("Test");
  });
  it("rejects changed source text without partial mutation", async () => {
    await importBackup(pack());
    const changed = pack();
    changed.tables.pages[0] = { ...p, text: p.text + " More text." };
    changed.tables.subjects.push({ id: "extra", name: "Extra", updatedAt: 1 });
    await expect(importBackup(changed)).rejects.toThrow("Source conflict");
    expect(await db.subjects.get("extra")).toBeUndefined();
  });
  it("merges review-only source metadata conflicts without blocking transfers", async () => {
    await importBackup(pack());
    const changed = pack();
    changed.tables.pages[0] = { ...p, reviewed: true };
    await expect(importBackup(changed)).resolves.toBeUndefined();
    expect((await db.pages.get(p.id)).reviewed).toBe(false);
  });
  it("explicit replacement restores incoming data transactionally", async () => {
    await initialize();
    await importBackup(pack(), "replace");
    expect(await db.subjects.count()).toBe(1);
    expect(await db.cards.count()).toBe(1);
  });
  it("does not report object property order as an import conflict", async () => {
    await importBackup(pack());
    await db.pages.put({ ...p });
    expect((await inspectImport(pack())).conflicts).toHaveLength(0);
  });
});
