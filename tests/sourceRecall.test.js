import {it,expect} from 'vitest';
import {sourceRecallDrafts,legacyDraft,needsReview,recallQuestion} from '../src/sourceRecall';
const page=text=>({id:'doc:1',documentId:'doc',number:1,text});
it('blocks bullet-definition questions even if their ID and version look current',()=>{
 expect(needsReview({id:'imported',generationVersion:3,verified:true,prompt:'What is ● Habitat?'})).toBe(true);
 expect(needsReview({id:'imported',generationVersion:3,verified:true,prompt:'What is Habitat?'})).toBe(true);
});
it('asks a topic-specific habitat question without copying bullet markers',()=>{
 expect(recallQuestion('Habitat','Example organisms','Found in a site except one species.')).toBe('Where are Example organisms normally found, and what exception is noted?');
});
it('keeps full wrapped bullets and verbatim excerpts instead of defining labels',()=>{
 const p=page('Example Organism\n● Morphology: first part of the description\ncontinues with an important exception.\n● Habitat: another complete note.');
 const [card]=sourceRecallDrafts(p,'s');expect(card.prompt).toContain('Example Organism');expect(card.prompt).not.toContain('What is');expect(card.answer).toBe('first part of the description continues with an important exception.');expect(p.text.includes(card.quote)).toBe(true);
});
it('skips demographic/clinical keywords when their organism context is absent',()=>{
 expect(sourceRecallDrafts(page('Primary Diseases:\n● Males: example symptoms.\nPathognomonic / High-Yield Signs:\n● Clinical: example findings.'),'s')).toEqual([]);
});
it('retains a multi-line parent heading for nested bullets',()=>{
 const [c]=sourceRecallDrafts(page('● Example Medium\n(Supplemented): contains:\n○ Compound A: first effect\nwith an exception.\n○ Compound B: second effect.'),'s');expect(c.prompt).toContain('Example Medium (Supplemented)');expect(c.answer).toBe('first effect with an exception.');
});
it('does not split a continuation containing Note or a wrapped parenthesis',()=>{
 const cards=sourceRecallDrafts(page('● Named feature: explanation that continues in\na specimen. (Note: only in this setting.)\n● Limitation (Test of\nCure): full limitation continues\non this line.'),'s');expect(cards).toHaveLength(2);expect(cards[0].answer).toContain('(Note: only in this setting.)');expect(cards[1].prompt).toContain('Limitation (Test of Cure)');
});
it('handles hyphen keyword notes without leaking the previous organism into Other Species',()=>{
 const cards=sourceRecallDrafts(page('A. example\n- CS: example syndrome\nB. sample\n- CS: different syndrome\nOther Species\n- CS: an unspecified syndrome'),'s');expect(cards).toHaveLength(2);expect(cards[0].prompt).toContain('A. example');expect(cards[1].prompt).toContain('B. sample');expect(cards[1].answer).toBe('different syndrome');
});
it('does not turn dangling lists or scrambled mathematical text into facts',()=>{
 expect(sourceRecallDrafts(page('● A label: includes:\n● Temperature: – for 35°𝐶 37°𝐶 72ℎ𝑜𝑢𝑟𝑠'),'s')).toEqual([]);
});
it('older generated cards require review even if previously approved',()=>{
 const c={id:'draft-doc:1-4',verified:true};expect(legacyDraft(c)).toBe(true);expect(needsReview(c)).toBe(true);expect(needsReview({...c,generationVersion:2})).toBe(false);expect(needsReview({...c,generationVersion:2,needsContext:true})).toBe(true);
});
