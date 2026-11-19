import Dexie from "dexie";
import { tableNames, validateBackup, schemas, cleanAcceptedAnswers } from "./model";
import {legacyDraft, sourceRecallDrafts, brokenQuestion} from './sourceRecall';
export const db = new Dexie("medimate-local-v1");
db.version(1).stores({
  subjects: "id",
  documents: "id,subjectId",
  pages: "id,documentId,[documentId+number]",
  cards: "id,subjectId,documentId,kind",
  attempts: "id,mode",
  settings: "id",
  files: "id",
});
export const uid = () => crypto.randomUUID();
export async function approveDrafts(ids) {
  return db.transaction('rw', db.cards, db.pages, db.documents, db.subjects, async () => {
    let approved = 0, skipped = 0;
    const now = Date.now();
    for (const id of new Set(ids)) {
      const card = await db.cards.get(id);
      if (!card) continue;
      if (legacyDraft(card) || card.needsContext || brokenQuestion(card)) {skipped++;continue;}
      if (card.verified) continue;
      const source = await db.pages.get(`${card.documentId}:${card.page}`);
      const document = await db.documents.get(card.documentId);
      const choicesValid = !card.options?.length ||
        (card.kind === 'question' && card.options.length >= 2 &&
          card.options.includes(card.answer) && new Set(card.options).size === card.options.length);
      if (!schemas.cards.safeParse(card).success || !card.quote.trim() ||
          !card.prompt.trim() || !card.answer.trim() || !choicesValid ||
          !source?.text.includes(card.quote) || document?.subjectId !== card.subjectId ||
          !await db.subjects.get(card.subjectId)) {
        skipped++;
        continue;
      }
      await db.cards.update(id, {verified: true, verifiedAt: now, updatedAt: now});
      approved++;
    }
    return {approved, skipped};
  });
}
// Adds one explicitly chosen variant. The item's wording, source and verification are untouched.
export async function addAcceptedAnswer(cardId, response) {
  return db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) throw Error('This study item no longer exists.');
    if (card.options?.length) throw Error('Multiple-choice questions are graded against their listed choices only.');
    const current = card.acceptedAnswers || [];
    const next = cleanAcceptedAnswers([...current, response], card.answer);
    if (next.length === current.length) return false;
    const checked = schemas.cards.shape.acceptedAnswers.safeParse(next);
    if (!checked.success) throw Error('This item already has the maximum of 20 accepted answers, or the answer is too long.');
    await db.cards.update(cardId, { acceptedAnswers: next, updatedAt: Date.now() });
    return true;
  });
}
export async function initialize() {
  await db.transaction("rw", db.subjects, db.settings, async () => {
    const profile = await db.settings.get("profile");
    // Replace only the untouched old placeholder; a name she typed in Settings is kept.
    if (profile?.name === "Future RMT") await db.settings.update("profile", { name: "Sheanienne", updatedAt: Date.now() });
    if (!profile) {
      await db.settings.put({
        id: "profile",
        name: "Sheanienne",
        goal: "A little progress, every day.",
        examDate: "",
        dailyTarget: 10,
        updatedAt: Date.now(),
      });
      if (!(await db.subjects.count()))
        await db.subjects.bulkAdd(
          [
            "Clinical Chemistry",
            "Hematology",
            "Microbiology",
            "Immunology & Serology",
            "Clinical Microscopy",
            "Blood Banking",
          ].map((name) => ({ id: uid(), name, updatedAt: Date.now() })),
        );
    }
  });
  // Upgrade only untouched generated wording; never replace a user's edited question.
  await db.transaction('rw',db.cards,db.pages,async()=>{
    for(const old of await db.cards.filter(c=>c.generationVersion===2&&!c.needsContext).toArray()){
      const page=await db.pages.get(`${old.documentId}:${old.page}`);
      if(!page)continue;
      const replacement=sourceRecallDrafts(page,old.subjectId).find(c=>c.id===old.id);
      if(!replacement||!/^In “.+”, what does the trans state under “.+”\?$/.test(old.prompt)||replacement.answer!==old.answer)continue;
      await db.cards.update(old.id,{prompt:replacement.prompt,generationVersion:3,verified:false,verifiedAt:null,updatedAt:Date.now(),previousDraft:old.previousDraft||{prompt:old.prompt,answer:old.answer,quote:old.quote,verified:old.verified}});
    }
  });
}
export async function rebuildLegacyDrafts() {
  return db.transaction('rw',db.cards,db.pages,async()=>{
    let rewritten=0,flagged=0;
    const cache=new Map();
    for(const old of await db.cards.filter(legacyDraft).toArray()){
      const pageId=`${old.documentId}:${old.page}`;
      if(!cache.has(pageId)){const page=await db.pages.get(pageId);cache.set(pageId,page?sourceRecallDrafts(page,old.subjectId):[]);}
      const replacement=cache.get(pageId).find(c=>c.id===old.id);
      const previousDraft={prompt:old.prompt,answer:old.answer,quote:old.quote,verified:old.verified};
      if(replacement){await db.cards.put({...old,...replacement,previousDraft});rewritten++;}
      else {await db.cards.update(old.id,{verified:false,verifiedAt:null,generationVersion:2,needsContext:true,previousDraft,updatedAt:Date.now()});flagged++;}
    }
    return {rewritten,flagged};
  });
}
// Repair only unverified machine-generated items. Never silently verify or delete.
export async function repairGeneratedDrafts() {
  return db.transaction('rw',db.cards,db.pages,async()=>{
    let repaired=0,flagged=0,unchanged=0;
    const clean=s=>s.replace(/[●○•◦▪‣]/g,'').replace(/\s+/g,' ').trim();
    for(const old of await db.cards.toArray()){
      if(old.verified||old.userEdited||!old.id.startsWith('draft-'))continue;
      const page=await db.pages.get(`${old.documentId}:${old.page}`);
      const next=page&&await db.pages.get(`${old.documentId}:${old.page+1}`);
      const fresh=page?sourceRecallDrafts(page,old.subjectId,{includeAmbiguous:true,nextPageText:next?.text||''}):[];
      const previousDraft=old.previousDraft||{prompt:old.prompt,answer:old.answer,quote:old.quote,verified:old.verified};
      if(!old.needsContext&&!legacyDraft(old)&&!brokenQuestion(old)){
        // Untouched drafts pick up parser corrections (e.g. a heading glued onto an answer); unknown ones are left alone.
        const same=fresh.find(c=>c.id===old.id);
        if(same&&(same.needsContext||['prompt','answer','quote'].some(k=>same[k]!==old[k]))){await db.cards.put({...old,...same,previousDraft,verified:false,verifiedAt:null});repaired++;if(same.needsContext)flagged++;}
        else unchanged++;
        continue;
      }
      const candidates=fresh.filter(c=>clean(old.quote).length>=12&&clean(c.quote).includes(clean(old.quote)));
      const candidate=candidates.length===1?candidates[0]:null;
      if(candidate){await db.cards.put({...old,...candidate,id:old.id,previousDraft,verified:false,verifiedAt:null});repaired++;if(candidate.needsContext)flagged++;}
      else {await db.cards.update(old.id,{needsContext:true,verified:false,verifiedAt:null,previousDraft,updatedAt:Date.now()});flagged++;}
    }
    return {repaired,flagged,unchanged};
  });
}
export async function exportBackup() {
  const { tables, files } = await db.transaction("r", db.tables, async () => ({
    tables: Object.fromEntries(
      await Promise.all(
        tableNames.map(async (t) => [t, await db[t].toArray()]),
      ),
    ),
    files: await db.files.toArray(),
  }));
  const encoded = await Promise.all(
    files.map(async (f) => ({
      id: f.id,
      data: await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(f.blob);
      }),
    })),
  );
  return {
    format: "medimate",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
    files: encoded,
  };
}
export async function inspectImport(raw) {
  const backup = validateBackup(raw);
  let conflicts = [];
  for (const t of tableNames) {
    for (const item of backup.tables[t]) {
      const old = await db[t].get(item.id);
      if (old && JSON.stringify(schemas[t].parse(old)) !== JSON.stringify(item))
        conflicts.push(`${t}: ${item.name || item.prompt || item.id}`);
    }
  }
  return { backup, conflicts };
}
export async function importBackup(backup, policy = "keep") {
  backup = validateBackup(backup);
  const files = backup.files.map((f) => ({
    id: f.id,
    blob: new Blob(
      [Uint8Array.from(atob(f.data.split(",")[1]), (c) => c.charCodeAt(0))],
      { type: "application/pdf" },
    ),
  }));
  await db.transaction("rw", db.tables, async () => {
    if (policy === "replace") {
      for (const t of db.tables) await t.clear();
    } else {
      // Reject changed source identities: retaining local rows must never attach new cards to a different source.
      for (const t of ["documents", "pages"])
        for (const row of backup.tables[t]) {
          const old = await db[t].get(row.id);
          const fields =
            t === "documents"
              ? ["subjectId", "total", "hash"]
              : ["documentId", "number", "text"];
          if (old && fields.some((key) => old[key] !== row[key]))
            throw Error(
              "Source conflict. Export your current library, then use Replace to restore this backup.",
            );
        }
    }
    for (const t of tableNames)
      for (const item of backup.tables[t]) {
        if (policy === "replace" || !(await db[t].get(item.id)))
          await db[t].put(item);
      }
    for (const f of files)
      if (policy === "replace" || !(await db.files.get(f.id)))
        await db.files.put(f);
  });
}
