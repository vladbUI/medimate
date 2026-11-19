import { z } from "zod";
import { sourceRecallDrafts, needsReview, legacyDraft, brokenQuestion } from './sourceRecall';
const id = z.string().min(1).max(200);
const text = z.string().max(200000);
const base = { id, updatedAt: z.number().finite().nonnegative() };
export const schemas = {
  subjects: z.object({ ...base, name: z.string().min(1).max(100) }),
  documents: z.object({
    ...base,
    subjectId: id,
    name: z.string().min(1).max(240),
    total: z.number().int().min(1).max(3000),
    hash: id,
  }),
  pages: z.object({
    ...base,
    documentId: id,
    number: z.number().int().min(1).max(3000),
    text,
    status: z.enum(["extracted", "needs-review", "failed"]),
    error: z.string().max(1000),
    reviewed: z.boolean(),
  }),
  cards: z.object({
    ...base,
    subjectId: id,
    prompt: z.string().min(1).max(4000),
    answer: z.string().min(1).max(10000),
    documentId: id,
    page: z.number().int().positive(),
    quote: z.string().min(1).max(10000),
    verified: z.boolean(),
    verifiedAt: z.number().nonnegative().nullable(),
    due: z.number().nonnegative(),
    interval: z.number().min(0).max(365),
    kind: z.enum(["flashcard", "question"]),
    options: z.array(z.string().min(1).max(2000)).max(8),
    generationVersion: z.number().int().min(1).max(100).optional(),
    needsContext: z.boolean().optional(),
    userEdited: z.boolean().optional(),
    previousDraft: z.object({prompt:text,answer:text,quote:text,verified:z.boolean()}).optional(),
    // Optional additions stay backward compatible: older backups simply omit them.
    acceptedAnswers: z.array(z.string().min(1).max(2000)).max(20).optional(),
    reviewNote: z.string().max(500).optional(),
  }),
  attempts: z.object({
    ...base,
    mode: z.enum(["flashcard", "quiz", "moving"]),
    score: z.number().nonnegative(),
    total: z.number().int().positive(),
    details: z
      .array(
        z.object({
          cardId: id,
          prompt: text,
          answer: text,
          response: text,
          correct: z.boolean(),
          acceptedAs: text.optional(),
        }),
      )
      .max(500),
  }),
  settings: z.object({
    id: z.literal("profile"),
    name: z.string().min(1).max(80),
    goal: z.string().max(200),
    examDate: z.string().max(10),
    dailyTarget: z.number().int().min(1).max(100),
    updatedAt: z.number().nonnegative(),
  }),
};
export const tableNames = Object.keys(schemas);
export function coverage(pages, total) {
  return {
    attempted: pages.length,
    extracted: pages.filter((p) => p.status === "extracted").length,
    flagged: pages.filter((p) => p.status !== "extracted").length,
    remaining: Math.max(0, total - pages.length),
  };
}
export function normalize(s) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
export function nextReview(card, good, now = Date.now()) {
  const interval = good ? Math.min(365, Math.max(1, card.interval * 2)) : 0;
  return {
    interval,
    due: now + (good ? interval * 86400000 : 600000),
    updatedAt: now,
  };
}
export function eligible(card, pages) {
  const p = pages.find(
    (p) => p.documentId === card.documentId && p.number === card.page,
  );
  return !!(!needsReview(card) && p && p.text.includes(card.quote));
}
export function currentSessionCard(snapshot, cards, pages) {
  const current = cards.find(card=>card.id===snapshot.id);
  const variants = card => JSON.stringify(card.acceptedAnswers || []);
  return current && eligible(current,pages) && ['prompt','answer','quote','documentId','page','kind'].every(key=>current[key]===snapshot[key]) && variants(current)===variants(snapshot) ? current : null;
}
// Why an item is (or is not) ready for practice. "stale" = verified, but its excerpt no longer matches the saved source page.
export function reviewStatus(card, pages) {
  if (legacyDraft(card)) return 'legacy';
  if (card.needsContext || brokenQuestion(card)) return 'context';
  if (!card.verified) return 'draft';
  return eligible(card, pages) ? 'verified' : 'stale';
}
// Grading ignores case, spacing, typographic quotes and closing punctuation only. Nothing is inferred.
export const gradeKey = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().replace(/[.!?;,]+$/, '').trim();
export function cleanAcceptedAnswers(list, answer) {
  const seen = new Set([gradeKey(answer)]), kept = [];
  for (const raw of list) {
    const value = String(raw).trim(), key = gradeKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key); kept.push(value);
  }
  return kept;
}
// Shown after each quiz/exam answer; n varies the wording from question to question.
export function encouragement(name, result, n = 0) {
  const lines = result.correct
    ? [`You got it, ${name}! So proud of you.`, `Look at you go, ${name}! That's exactly right.`, `Yes, ${name}! You really know this. Keep shining.`]
    : result.response?.trim()
      ? [`Aww, not quite, ${name}. That's okay, you're learning so much. Keep going!`, `Don't be down, ${name}. You're doing wonderfully, and the next one is yours.`, `It's okay, ${name}. Every mistake brings you closer to RMT. You've got this!`]
      : [`That one slipped by, ${name}. No worries at all. Take a breath and keep going!`];
  return lines[n % lines.length];
}
export function sessionCheer(name, score, total) {
  if (score === total) return `A perfect score, ${name}! You should be so proud of yourself.`;
  if (score === 0) return `Don't be down, ${name}. You showed up and practiced today, and that's what counts. Keep going, you've got this!`;
  return `You did it, ${name}! Look over the ones you missed below. You're getting closer every day.`;
}
export function gradeResponse(card, response) {
  const key = gradeKey(response);
  if (!key) return { correct: false };
  // Multiple choice is graded against its listed choices only.
  if (card.options?.length) return { correct: normalize(response) === normalize(card.answer) };
  if (key === gradeKey(card.answer)) return { correct: true };
  const acceptedAs = (card.acceptedAnswers || []).find(a => gradeKey(a) === key);
  return acceptedAs === undefined ? { correct: false } : { correct: true, acceptedAs };
}
// Quizzes and moving exams draw only from verified items whose source still matches.
export function practicePool(cards, pages, { subject = '', includeFlashcards = false } = {}) {
  const ready = cards.filter(c => eligible(c, pages) && (!subject || c.subjectId === subject));
  const questions = ready.filter(c => c.kind === 'question');
  const copied = new Set(questions.map(q => q.id));
  const flashcards = ready.filter(c => c.kind === 'flashcard' && !copied.has(`question-${c.id}`));
  return { questions, flashcards, cards: includeFlashcards ? [...questions, ...flashcards] : questions };
}
export const draftDefinitions = sourceRecallDrafts;
export function validateBackup(input) {
  const header = z
    .object({
      format: z.literal("medimate"),
      version: z.literal(1),
      tables: z.record(z.string(), z.array(z.unknown())),
      files: z.array(z.object({ id, data: z.string().max(70000000) })).max(500),
    })
    .parse(input);
  const tables = Object.fromEntries(
    tableNames.map((t) => [
      t,
      z
        .array(schemas[t])
        .max(100000)
        .parse(header.tables[t] ?? []),
    ]),
  );
  for (const t of tableNames)
    if (new Set(tables[t].map((x) => x.id)).size !== tables[t].length)
      throw Error(`Duplicate IDs in ${t}.`);
  const subjects = new Set(tables.subjects.map((x) => x.id));
  const documents = new Map(tables.documents.map((x) => [x.id, x]));
  const pages = new Map();
  for (const p of tables.pages) {
    const d = documents.get(p.documentId);
    const key = `${p.documentId}:${p.number}`;
    if (!d || p.number > d.total || pages.has(key) || p.id !== key)
      throw Error("Invalid or duplicate page reference.");
    pages.set(key, p);
  }
  for (const d of tables.documents)
    if (!subjects.has(d.subjectId)) throw Error("Document subject missing.");
  for (const c of tables.cards) {
    const p = pages.get(`${c.documentId}:${c.page}`);
    if (
      !subjects.has(c.subjectId) ||
      !p ||
      !p.text.includes(c.quote) ||
      documents.get(c.documentId).subjectId !== c.subjectId
    )
      throw Error("Card source is missing or quote does not match.");
    if (
      c.options.length &&
      (!c.options.includes(c.answer) ||
        new Set(c.options).size !== c.options.length)
    )
      throw Error("Invalid question choices.");
  }
  for (const a of tables.attempts)
    if (a.score > a.total) throw Error("Invalid score.");
  if (new Set(header.files.map((f) => f.id)).size !== header.files.length)
    throw Error("Duplicate files.");
  for (const f of header.files)
    if (
      !documents.has(f.id) ||
      !/^data:application\/pdf;base64,[A-Za-z0-9+/]*={0,2}$/.test(f.data)
    )
      throw Error("Invalid PDF attachment.");
  return { ...header, tables };
}
