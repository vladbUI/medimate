import 'fake-indexeddb/auto';
import {beforeEach,it,expect} from 'vitest';
import {db,repairGeneratedDrafts,approveDrafts} from '../src/db';
import {sourceRecallDrafts,brokenQuestion} from '../src/sourceRecall';
const page={id:'d:1',documentId:'d',number:1,text:'Primary Diseases:\n● Males: Acute purulent urethritis,\nprostatitis, epididymitis.',status:'extracted',error:'',reviewed:false,updatedAt:1};
beforeEach(async()=>{await Promise.all(db.tables.map(t=>t.clear()));await db.pages.add(page);});
it('retains complete ambiguous bullets for repair without inventing a topic',()=>{
 expect(sourceRecallDrafts(page,'s')).toHaveLength(0);
 const c=sourceRecallDrafts(page,'s',{includeAmbiguous:true})[0];
 expect(c.answer).toBe('Acute purulent urethritis, prostatitis, epididymitis.');
 expect(c.needsContext).toBe(true);expect(brokenQuestion(c)).toBe(true);
});
it('repairs truncation, preserves old wording and blocks bulk verification',async()=>{
 const c=sourceRecallDrafts(page,'s',{includeAmbiguous:true})[0];
 await db.cards.add({...c,id:'draft-old',prompt:'What is ● Males?',answer:'Acute purulent urethritis,',quote:'● Males: Acute purulent urethritis,',generationVersion:2});
 expect(await repairGeneratedDrafts()).toMatchObject({repaired:1,flagged:1});
 const repaired=await db.cards.get('draft-old');
 expect(repaired.previousDraft.prompt).toBe('What is ● Males?');
 expect(repaired.quote).toBe('● Males: Acute purulent urethritis,\nprostatitis, epididymitis.');
 expect(await approveDrafts(['draft-old'])).toMatchObject({approved:0,skipped:1});
});
it('leaves verified and manually authored items unchanged',async()=>{
 const c=sourceRecallDrafts(page,'s',{includeAmbiguous:true})[0];
 await db.cards.bulkAdd([{...c,id:'manual'},{...c,id:'draft-verified',verified:true}]);
 const before=await db.cards.toArray();await repairGeneratedDrafts();expect(await db.cards.toArray()).toEqual(before);
});
it('corrects untouched drafts after a parser fix but never verified or edited ones', async () => {
 await db.pages.put({...page,id:'d:2',number:2,text:'Example Topic Here\n● Feature: a complete note.\nNext Heading Here\n● Other: more.'});
 const fresh=sourceRecallDrafts({...page,id:'d:2',number:2,text:'Example Topic Here\n● Feature: a complete note.\nNext Heading Here\n● Other: more.'},'s')[0];
 const stale={...fresh,answer:'a complete note. Next Heading Here',quote:'● Feature: a complete note.\nNext Heading Here'};
 await db.cards.bulkAdd([stale,{...stale,id:'draft-d:2-9',verified:true},{...stale,id:'draft-d:2-8',userEdited:true}]);
 expect(await repairGeneratedDrafts()).toMatchObject({repaired:1});
 expect(await db.cards.get(fresh.id)).toMatchObject({answer:'a complete note.',verified:false,previousDraft:{answer:'a complete note. Next Heading Here'}});
 expect((await db.cards.get('draft-d:2-9')).answer).toBe(stale.answer);
 expect((await db.cards.get('draft-d:2-8')).answer).toBe(stale.answer);
});
