import { db } from './db';
import { schemas, eligible } from './model';
import { sourceRecallDrafts } from './sourceRecall';

export async function renameSubject(id, name) {
  const row=await db.subjects.get(id);
  if(!row)throw Error('Subject no longer exists.');
  const next=schemas.subjects.parse({...row,name:name.trim(),updatedAt:Date.now()});
  await db.subjects.put(next);
}
export async function removeEmptySubject(id) {
  return db.transaction('rw',db.subjects,db.documents,db.cards,async()=>{
    if(await db.documents.where('subjectId').equals(id).count() || await db.cards.where('subjectId').equals(id).count())
      throw Error('Move or remove this subject’s transes and study items first.');
    await db.subjects.delete(id);
  });
}
export async function updateDocument(id, name, subjectId) {
  return db.transaction('rw',db.documents,db.cards,db.subjects,async()=>{
    const old=await db.documents.get(id);
    if(!old||!await db.subjects.get(subjectId))throw Error('Document or destination subject is missing.');
    await db.documents.put(schemas.documents.parse({...old,name:name.trim(),subjectId,updatedAt:Date.now()}));
    await db.cards.where('documentId').equals(id).modify({subjectId,updatedAt:Date.now()});
  });
}
export async function removeDocument(id) {
  return db.transaction('rw',db.documents,db.pages,db.files,db.cards,async()=>{
    await db.cards.where('documentId').equals(id).delete();
    await db.pages.where('documentId').equals(id).delete();
    await db.files.delete(id); await db.documents.delete(id);
  });
}
// Ambiguous units are saved as flagged drafts (never skipped silently, never given a guessed topic).
export async function generateDocumentDrafts(id, {pageNumber=null} = {}) {
  return db.transaction('rw',db.documents,db.pages,db.cards,async()=>{
    const doc=await db.documents.get(id);if(!doc)throw Error('Document no longer exists.');
    const pages=await db.pages.where('documentId').equals(id).toArray();
    const text=new Map(pages.map(p=>[p.number,p.text]));
    let added=0,existing=0,withoutDrafts=0,flagged=0;
    for(const page of pages){
      if(pageNumber!==null&&page.number!==pageNumber)continue;
      const drafts=sourceRecallDrafts(page,doc.subjectId,{includeAmbiguous:true,nextPageText:text.get(page.number+1)||''});
      if(!drafts.length)withoutDrafts++;
      for(const card of drafts){if(await db.cards.get(card.id)){existing++;continue;}await db.cards.add(card);added++;if(card.needsContext)flagged++;}
    }
    return {added,existing,withoutDrafts,flagged,pending:Math.max(0,doc.total-pages.length)};
  });
}
export async function copyAsQuestion(id) {
  return db.transaction('rw',db.cards,db.pages,async()=>{
    const card=await db.cards.get(id);if(!card)throw Error('Study item no longer exists.');
    const questionId=`question-${id}`;
    if(await db.cards.get(questionId))return {created:false,id:questionId};
    const verified=eligible(card,await db.pages.toArray());
    await db.cards.add({...card,id:questionId,kind:'question',options:[],verified,verifiedAt:verified?card.verifiedAt:null,updatedAt:Date.now(),due:0,interval:0});
    return {created:true,id:questionId};
  });
}
