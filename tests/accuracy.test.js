import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, addAcceptedAnswer, approveDrafts, importBackup, exportBackup } from '../src/db';
import { generateDocumentDrafts } from '../src/libraryActions';
import { sourceRecallDrafts, continuesOnNextPage, brokenQuestion } from '../src/sourceRecall';
import { gradeResponse, cleanAcceptedAnswers, practicePool, reviewStatus, currentSessionCard, eligible, validateBackup } from '../src/model';

const page = (text, number = 1) => ({ id: `d:${number}`, documentId: 'd', number, text, status: 'extracted', error: '', reviewed: false, updatedAt: 1 });
const all = (text, options = {}) => sourceRecallDrafts(page(text), 's', { includeAmbiguous: true, ...options });

describe('source context is never guessed', () => {
  it('does not treat a sentence fragment at the top of a page as the topic', () => {
    const [card] = all('prostatitis, epididymitis.\n● Females: example findings.');
    expect(card.needsContext).toBe(true);
    expect(card.prompt).not.toContain('prostatitis');
    expect(brokenQuestion(card)).toBe(true);
  });
  it('flags nested bullets whose generic parent has no named section', () => {
    const [card] = all('● Morphology: described as follows:\n○ Size: an example measurement.');
    expect(card.needsContext).toBe(true);
    expect(card.prompt).toContain('[add organism/topic]');
    expect(card.prompt).toContain('Morphology — Size');
    expect(card.answer).toBe('an example measurement.');
  });
  it('keeps the named section with a generic parent instead of dropping it', () => {
    const [card] = all('Example Organism\n● Morphology: described as follows:\n○ Size: an example measurement.');
    expect(card.needsContext).toBe(false);
    expect(card.prompt).toBe('In “Example Organism — Morphology”, what does the trans state under “Size”?');
  });
  it('does not attribute bullets to the section above an unbulleted introduction line', () => {
    const cards = all('Primary Diseases:\n● Males: example symptoms.\nSample Medium (Supplemented): contains:\n● Compound A: an example effect.');
    expect(cards[1].prompt).toBe('In “Sample Medium (Supplemented)”, what does the trans state under “Compound A”?');
    expect(cards[1].prompt).not.toContain('Primary Diseases');
  });
  it('ends an answer at a following heading instead of absorbing it', () => {
    const cards = all('Key Tests:\n○ Species A: ONPG-negative.\nDifferentiating Moraxella catarrhalis\n● Clinical Significance: a common cause.\n● Detail: sensitivity rises 5- to 100- fold\nMorphology\n- H. influenzae: small rods.');
    expect(cards.map(c => c.answer)).toEqual(['ONPG-negative.', 'a common cause.', 'sensitivity rises 5- to 100- fold', 'small rods.']);
    expect(cards[1].prompt).toContain('Differentiating Moraxella catarrhalis');
    expect(cards[3].prompt).toBe('In “Morphology”, what does the trans state under “H. influenzae”?');
  });
  it('keeps a label wrapped over two lines as the parent of its sub-bullets', () => {
    const [card] = all('● Gram Stain (Urethral Discharge from\nSymptomatic Males):\n○ Diagnostic Value: an example finding.');
    expect(card.needsContext).toBe(false);
    expect(card.prompt).toContain('Gram Stain (Urethral Discharge from Symptomatic Males)');
  });
  it('flags sub-bullets whose parent label was unreadable and vague labels with no topic', () => {
    const cards = all('● . vs. . :\n○ The Pitfall: both look alike.\nJoint Fluid)\n- Prep: clean the site\n- If delayed: use transport media');
    expect(cards.every(c => c.needsContext)).toBe(true);
  });
  it('flags cards under a procedure-only heading unless the card names its organism', () => {
    const cards = all('Specimen Collection & Transport\n● Swab Type: use synthetic swabs.\n● N. exampleus: needs a special swab.\nCulture Media\n● Chocolate Agar (CHOC): the primary medium.\nKey Species Differentiation:\n○ Neisseria lactamica: ONPG-positive.');
    expect(cards.map(c => [c.needsContext, c.prompt])).toEqual([
      [true, 'For [add organism/topic], what does the source describe under “Specimen Collection & Transport — Swab Type”?'],
      [false, 'In “Specimen Collection & Transport”, what does the trans state under “N. exampleus”?'],
      [true, 'For [add organism/topic], what does the source describe under “Culture Media — Chocolate Agar (CHOC)”?'],
      [false, 'In “Key Species Differentiation”, what does the trans state under “Neisseria lactamica”?'],
    ]);
  });
  it('removes extraction gaps before punctuation in answers but keeps the quote verbatim', () => {
    const [card] = all('Example Topic Here\n●   Habitat:   tract,   except   N.   gonorrhoeae ,   which ( see   note ) is “ quoted ” .');
    expect(card.answer).toBe('tract, except N. gonorrhoeae, which (see note) is “quoted”.');
    expect(card.quote).toBe('●   Habitat:   tract,   except   N.   gonorrhoeae ,   which ( see   note ) is “ quoted ” .');
  });
  it('skips questions the lecture poses but does not answer, and Note lines', () => {
    expect(all('Clinical Vignette\n- Patient: a 3 yr old with stridor. What is the organism?\n- Note: read chapter 12')).toEqual([]);
    expect(all('Example Topic Here\n● Logic: always ask “where did this come from? ”')).toHaveLength(1);
  });
  it('keeps page numbers out of answers without moving existing draft IDs', () => {
    const plain = all('Example Organism\n● Key feature: a complete note.');
    const numbered = all('Example Organism\n● Key feature: a complete note.\n12');
    expect(numbered[0].answer).toBe('a complete note.');
    expect(numbered[0].quote).toBe('● Key feature: a complete note.');
    expect(numbered[0].id).toBe(plain[0].id);
  });
});

describe('bullets cut by a page break', () => {
  const first = 'Example Organism\n● Key feature: the description begins here and';
  it('recognises a next page that starts mid-sentence', () => {
    expect(continuesOnNextPage('2\ncontinues on this page.\n● Other: note.')).toBe(true);
    expect(continuesOnNextPage('● Other: note.')).toBe(false);
    expect(continuesOnNextPage('Another Heading\n● Other: note.')).toBe(false);
    expect(continuesOnNextPage('')).toBe(false);
  });
  it('flags only the final bullet and leaves its wording untouched', () => {
    const cards = all(`Example Organism\n● First: a complete note.\n${first.split('\n')[1]}`, { nextPageText: 'continues on this page.' });
    expect(cards.map(c => !!c.needsContext)).toEqual([false, true]);
    expect(cards[1].reviewNote).toMatch(/next page/);
    expect(cards[1].answer).toBe('the description begins here and');
    expect(brokenQuestion(cards[1])).toBe(false);
  });
});

describe('document generation', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map(t => t.clear()));
    await db.subjects.add({ id: 's', name: 'Subject', updatedAt: 1 });
    await db.documents.add({ id: 'd', subjectId: 's', name: 'Lecture.pdf', total: 2, hash: 'h', updatedAt: 1 });
    await db.pages.bulkAdd([
      page('Primary Diseases:\n● Males: example symptoms.\nExample Organism\n● Key feature: the description begins here and', 1),
      page('continues on this page.\n● Other note: complete text.', 2),
    ]);
  });
  it('saves ambiguous units as flagged drafts that bulk approval cannot verify', async () => {
    const result = await generateDocumentDrafts('d');
    expect(result).toMatchObject({ added: 3, flagged: 2 });
    const cards = await db.cards.toArray();
    expect(cards.every(c => !c.verified)).toBe(true);
    expect(await approveDrafts(cards.map(c => c.id))).toEqual({ approved: 1, skipped: 2 });
    const pages = await db.pages.toArray();
    expect((await db.cards.toArray()).filter(c => eligible(c, pages))).toHaveLength(1);
  });
  it('limits single-page generation to that page and never duplicates', async () => {
    expect(await generateDocumentDrafts('d', { pageNumber: 2 })).toMatchObject({ added: 1, flagged: 0 });
    expect(await generateDocumentDrafts('d')).toMatchObject({ added: 2, existing: 1 });
  });
});

describe('accepted answers', () => {
  const card = { answer: 'Neisseria gonorrhoeae', options: [], acceptedAnswers: ['N. gonorrhoeae', 'Gonococcus'] };
  it('accepts the answer and listed variants, ignoring case, spacing and closing punctuation', () => {
    expect(gradeResponse(card, '  neisseria   GONORRHOEAE. ')).toEqual({ correct: true });
    expect(gradeResponse(card, 'n. gonorrhoeae')).toEqual({ correct: true, acceptedAs: 'N. gonorrhoeae' });
    expect(gradeResponse(card, 'gonococcus!')).toEqual({ correct: true, acceptedAs: 'Gonococcus' });
  });
  it('never accepts unrelated, partial or empty answers', () => {
    for (const response of ['', '   ', '.', 'Neisseria', 'Neisseria meningitidis', 'gonorrhoeae', 'Neisseria gonorrhoeae and others'])
      expect(gradeResponse(card, response).correct).toBe(false);
    expect(gradeResponse({ answer: 'A' }, 'a').correct).toBe(true);
  });
  it('grades multiple choice against its choices only', () => {
    const mcq = { answer: 'Choice A', options: ['Choice A', 'Choice B'], acceptedAnswers: ['Choice B'] };
    expect(gradeResponse(mcq, 'Choice B').correct).toBe(false);
    expect(gradeResponse(mcq, 'Choice A').correct).toBe(true);
  });
  it('drops blank lines, duplicates and copies of the main answer', () => {
    expect(cleanAcceptedAnswers([' GC ', 'gc.', '', 'Neisseria gonorrhoeae', 'Gonococcus'], 'Neisseria gonorrhoeae')).toEqual(['GC', 'Gonococcus']);
  });
});

describe('practice bank', () => {
  const source = page('Example term: An illustrative definition for testing.');
  const base = { ...sourceRecallDrafts(source, 's')[0], verified: true, verifiedAt: 1 };
  const cards = [
    { ...base, id: 'flash' },
    { ...base, id: 'copied' },
    { ...base, id: 'question-copied', kind: 'question' },
    { ...base, id: 'draft', verified: false },
    { ...base, id: 'ambiguous', needsContext: true },
    { ...base, id: 'stale', quote: 'Text that is no longer on the page.' },
    { ...base, id: 'other', subjectId: 'x', kind: 'question' },
  ];
  it('uses verified questions, adds verified flashcards on request, and excludes everything else', () => {
    expect(practicePool(cards, [source]).cards.map(c => c.id)).toEqual(['question-copied', 'other']);
    expect(practicePool(cards, [source], { includeFlashcards: true }).cards.map(c => c.id)).toEqual(['question-copied', 'other', 'flash']);
    expect(practicePool(cards, [source], { subject: 's', includeFlashcards: true }).cards.map(c => c.id)).toEqual(['question-copied', 'flash']);
    expect(practicePool(cards, []).cards).toEqual([]);
  });
  it('labels why an item is out of practice', () => {
    expect(cards.map(c => reviewStatus(c, [source]))).toEqual(['verified', 'verified', 'verified', 'draft', 'context', 'stale', 'verified']);
    expect(reviewStatus({ ...base, id: 'draft-old', generationVersion: undefined }, [source])).toBe('legacy');
  });
  it('restarts a running session when accepted answers change', () => {
    expect(currentSessionCard(base, [base], [source])).toEqual(base);
    expect(currentSessionCard(base, [{ ...base, acceptedAnswers: ['variant'] }], [source])).toBeNull();
  });
});

describe('stored data compatibility', () => {
  const source = page('Example term: An illustrative definition for testing.');
  const card = { ...sourceRecallDrafts(source, 's')[0], updatedAt: 1, verified: true, verifiedAt: 5 };
  const pack = extra => ({
    format: 'medimate', version: 1, files: [],
    tables: {
      subjects: [{ id: 's', name: 'Subject', updatedAt: 1 }],
      documents: [{ id: 'd', subjectId: 's', name: 'Lecture.pdf', total: 1, hash: 'h', updatedAt: 1 }],
      pages: [source], cards: [{ ...card, ...extra }], settings: [],
      attempts: [{ id: 'a', mode: 'quiz', score: 1, total: 1, updatedAt: 2, details: [{ cardId: card.id, prompt: 'p', answer: 'a', response: 'r', correct: true }] }],
    },
  });
  beforeEach(async () => { await Promise.all(db.tables.map(t => t.clear())); });
  it('imports a backup made before accepted answers existed without changing verification', async () => {
    await importBackup(pack());
    const saved = await db.cards.get(card.id);
    expect(saved).toMatchObject({ verified: true, verifiedAt: 5 });
    expect(saved.acceptedAnswers).toBeUndefined();
    expect(gradeResponse(saved, card.answer).correct).toBe(true);
  });
  it('round-trips accepted answers and review notes through export and import', async () => {
    await importBackup(pack({ acceptedAnswers: ['A variant'], reviewNote: 'Check the next page.' }));
    const tables = Object.fromEntries(await Promise.all(['subjects', 'documents', 'pages', 'cards', 'attempts', 'settings'].map(async t => [t, await db[t].toArray()])));
    const restored = validateBackup({ format: 'medimate', version: 1, files: [], tables });
    expect(restored.tables.cards[0]).toMatchObject({ acceptedAnswers: ['A variant'], reviewNote: 'Check the next page.' });
    expect(exportBackup).toBeTypeOf('function');
  });
  it('rejects malformed accepted answers instead of importing them', () => {
    expect(() => validateBackup(pack({ acceptedAnswers: [''] }))).toThrow();
    expect(() => validateBackup(pack({ acceptedAnswers: 'text' }))).toThrow();
  });
  it('adds an accepted answer only on request and keeps wording, source and verification', async () => {
    await importBackup(pack());
    expect(await addAcceptedAnswer(card.id, '  A reasonable variant ')).toBe(true);
    expect(await addAcceptedAnswer(card.id, 'a reasonable variant.')).toBe(false);
    expect(await addAcceptedAnswer(card.id, card.answer)).toBe(false);
    const saved = await db.cards.get(card.id);
    expect(saved).toMatchObject({ acceptedAnswers: ['A reasonable variant'], verified: true, verifiedAt: 5, prompt: card.prompt, answer: card.answer, quote: card.quote });
    await db.cards.update(card.id, { kind: 'question', options: [card.answer, 'Another choice'] });
    await expect(addAcceptedAnswer(card.id, 'Another choice')).rejects.toThrow('listed choices');
    await expect(addAcceptedAnswer('missing', 'x')).rejects.toThrow('no longer exists');
  });
});

describe('encouragement', () => {
  it('praises correct answers and encourages after wrong or blank ones, by name', async () => {
    const { encouragement, sessionCheer } = await import('../src/model');
    expect(encouragement('Sheanienne', { correct: true, response: 'x' }, 0)).toBe('You got it, Sheanienne! So proud of you.');
    expect(encouragement('Sheanienne', { correct: false, response: 'x' }, 1)).toBe("Don't be down, Sheanienne. You're doing wonderfully, and the next one is yours.");
    expect(encouragement('Sheanienne', { correct: false, response: ' ' }, 2)).toMatch(/slipped by.*keep going!$/);
    expect(sessionCheer('Sheanienne', 3, 3)).toMatch(/^A perfect score, Sheanienne!/);
    expect(sessionCheer('Sheanienne', 0, 3)).toMatch(/^Don't be down, Sheanienne\..*you've got this!$/);
  });
});
