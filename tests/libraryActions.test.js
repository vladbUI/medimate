import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/db';
import { generateDocumentDrafts, updateDocument, removeDocument, removeEmptySubject, renameSubject, copyAsQuestion } from '../src/libraryActions';
beforeEach(async()=>{
  await Promise.all(db.tables.map(t=>t.clear()));
  await db.subjects.bulkAdd([{id:'s',name:'Original',updatedAt:1},{id:'t',name:'Destination',updatedAt:1}]);
  await db.documents.add({id:'d',subjectId:'s',name:'Lecture.pdf',total:2,hash:'hash',updatedAt:1});
  await db.pages.add({id:'d:1',documentId:'d',number:1,text:'Example term: An illustrative definition for testing.',status:'extracted',reviewed:false,error:'',updatedAt:1});
});
it('generates across saved pages without overwriting edited cards',async()=>{
  expect(await generateDocumentDrafts('d')).toMatchObject({added:1,pending:1});
  const card=await db.cards.toCollection().first();
  await db.cards.update(card.id,{prompt:'My edited question'});
  expect(await generateDocumentDrafts('d')).toMatchObject({added:0,existing:1});
  expect((await db.cards.get(card.id)).prompt).toBe('My edited question');
});
it('moves related cards and prevents removal of occupied subjects',async()=>{
  await generateDocumentDrafts('d');
  await expect(removeEmptySubject('s')).rejects.toThrow('Move or remove');
  await updateDocument('d','Renamed.pdf','t');
  expect((await db.cards.toCollection().first()).subjectId).toBe('t');
  await removeEmptySubject('s');
  expect(await db.subjects.get('s')).toBeUndefined();
  await renameSubject('t','New name');
  expect((await db.subjects.get('t')).name).toBe('New name');
});
it('copies to quiz bank once without bypassing review and deletes dependencies',async()=>{
  await generateDocumentDrafts('d');
  const card=await db.cards.toCollection().first();
  const result=await copyAsQuestion(card.id);
  expect(result.created).toBe(true);
  expect(await db.cards.get(result.id)).toMatchObject({kind:'question',verified:false});
  expect((await copyAsQuestion(card.id)).created).toBe(false);
  await db.files.add({id:'d',blob:new Blob(['pdf'])});
  await removeDocument('d');
  expect(await db.cards.count()).toBe(0);
  expect(await db.pages.count()).toBe(0);
  expect(await db.files.count()).toBe(0);
  expect(await db.documents.count()).toBe(0);
});
