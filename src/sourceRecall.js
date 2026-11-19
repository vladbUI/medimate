// This parser creates literal source-recall prompts, not inferred medical definitions.
const bullet = /^\s*([●○•◦▪‣]|-(?=\s))\s*/u;
const compact = text => text.replace(/\s+/g, ' ').trim();
export function recallQuestion(label, scope, answer, literal = false) {
  if(scope&&!literal){
    if(/^habitat$/i.test(label)) return `Where are ${scope} normally found${/except|exception/i.test(answer)?', and what exception is noted':''}?`;
    if(/^morphology$/i.test(label)) return `What morphology is described for ${scope}?`;
    if(/^biochemical hallmark$/i.test(label)) return `What biochemical feature is highlighted for ${scope}?`;
    if(/^key trait$/i.test(label)) return `What distinguishing trait is described for ${scope}?`;
    if(/^inhibits\b/i.test(answer)) return `In ${scope}, what does ${label} inhibit?`;
  }
  return `${scope?`In “${scope}”, w`:'W'}hat does the trans state under “${label}”?`;
}
export const brokenQuestion = card => /\[add organism\/topic\]/i.test(card.prompt) || /^what\s+is\s+[●○•◦▪‣]/iu.test(card.prompt) || /^what\s+is\s+(?:habitat|males?|females?|clinical|laboratory|neonates?|primary diseases?)\s*\?$/i.test(card.prompt);
const genericLabel = /^(?:VF|CS|CD|MOT|males?|females?|neonates?|children|adults?(?:\/elderly)?|clinical|laboratory(?:\/clinical cascade)?|morphology|biochemical hallmark|key trait|habitat|primary diseases?|pathognomonic.*|safety precaution|diagnostic value|specimen limitations|sensitivity.*|critical limitation.*|timeframe|temperature requirements|incubation parameters)$/i;
const genericSection = /^(?:other species|general characteristics|primary diseases?|pathognomonic.*|laboratory reasoning|specimen collection.*|culture media.*|media of choice|selective media.*|biochemical differentiation|.*lecture|midterm reviewer)$/i;
// Headings made only of these words describe a procedure ("Specimen Collection & Transport"), not which organism or subject it is for.
const procedureWords = new Set('specimen specimens collection transport culture cultures media medium agar incubation conditions condition requirement requirements characteristics general morphology colony colonial differentiation differentiating biochemical key tests test testing detection direct gram stain staining diagnostic diagnostics diagnosis modern limitations limitation nucleic acid antigen molecular targets target special exceptions selective non-selective nonselective choice temperature duration atmosphere primary diseases disease clinical laboratory signs pathognomonic high-yield other species overview introduction summary notes reasoning pitfalls look out identification procedure procedures principle principles interpretation results treatment prevention susceptibility antimicrobial resistance virulence factors factor transmission epidemiology pathogenesis growth isolation methods method type types processing handling storage and of the for to with in on at their its an or'.split(' '));
const procedural = h => genericSection.test(h) || h.toLowerCase().replace(/[^a-z\s-]/g,' ').split(/\s+/).filter(w=>w.length>1).every(w=>procedureWords.has(w));
// A binomial ("Neisseria gonorrhoeae", "Haemophilus spp.") or abbreviated ("H. influenzae") organism name.
const namesOrganism = s => /\b[A-Z][a-z]+\s+(?:spp?\.|[a-z]{3,}(?:us|um|ae|is|ii|i|a|es)\b)|\b[A-Z]\.\s?[a-z]{4,}/.test(s);
const taxonHeading = line => /^(?:[A-Z]\.\s+[a-z]+(?:\s*\([^)]*\))?|[A-Z][a-z]+\s+spp\.)$/.test(compact(line));
// A bare page number at the top or bottom of a page is not lecture content.
const pageMarker = /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i;
// Leftover sentence fragments (e.g. a bullet continued from the previous page) must never become a topic.
const fragment = line => /^[a-z(,;]/.test(line) || /[.,;]$/.test(line) || line.length > 110;
const balanced = s => (s.match(/\(/g)||[]).length===(s.match(/\)/g)||[]).length;
// A topic needs two real words, or one capitalised word such as "Morphology"; ". vs. ." left by unreadable symbols is not a topic.
const usable = c => !!c&&!/^\d|lecture|reviewer/i.test(c)&&c.length<=150&&balanced(c)&&(c.split(/\s+/).filter(w=>/[A-Za-z]/.test(w)).length>=2||/^[A-Z][a-z]{3,}$/.test(c));
// Title-style words; a lowercase species name may follow its genus ("Moraxella catarrhalis", "M. catarrhalis").
const titleWords = words => words.every((w,i)=>/^[A-Z0-9]/.test(w)||/^(and|or|of|for|in|the|with|to|vs\.?)$/i.test(w)||(/^[a-z]+$/.test(w)&&/^(?:[A-Z]\.|[A-Z][a-z]{4,})$/.test(words[i-1]||'')));
const wordsOf = line => line.replace(/[()]/g,' ').split(/\s+/).filter(w=>/[A-Za-z]/.test(w));
// A label that names its own topic ("Gram Stain Interpretation Logic") can stand without a section; "Prep" or "If delayed" cannot.
const selfNamed = label => wordsOf(label).length>=2&&!/^(?:if|when|after|before|then)\b|\b(?:is|are|was|were)\b/i.test(label);
export const CONTINUES_NOTE = 'This bullet reaches the end of the page and the next page starts mid-sentence. Compare with the original PDF and complete the answer, or confirm that it is already complete.';
// True when the following page opens with what looks like the rest of a sentence.
export function continuesOnNextPage(nextPageText) {
  const first=(nextPageText||'').split('\n').map(l=>l.trim()).find(l=>l&&!pageMarker.test(l));
  return !!first&&!bullet.test(first)&&/^[a-z]/.test(first);
}
function heading(line) {
  if (line.length > 110 || bullet.test(line)) return false;
  if (/^[A-Z][^:]*:$/.test(line)) return true;
  const words = wordsOf(line);
  return words.length >= 2 && !/[.!?,;]$/.test(line) && titleWords(words);
}

export function sourceRecallDrafts(page, subjectId, {includeAmbiguous=false, nextPageText=''} = {}) {
  const rows=[]; let offset=0;
  for (const raw of page.text.split('\n')) { if(raw.trim()) rows.push({text:raw.trim(),start:offset+raw.indexOf(raw.trim()),end:offset+raw.trimEnd().length}); offset+=raw.length+1; }
  // Mark (rather than remove) page numbers so existing draft IDs, which use row positions, stay stable.
  for(let i=0;i<rows.length&&pageMarker.test(rows[i].text);i++)rows[i].marker=true;
  for(let i=rows.length-1;i>=0&&pageMarker.test(rows[i].text);i--)rows[i].marker=true;
  const lastContent=rows.findLast(r=>!r.marker);
  const blocks=[];let active=null,section='',parent='';
  function finish(){if(active){blocks.push(active);if(!active.nested){const match=compact(page.text.slice(active.start,active.end).replace(bullet,'')).match(/^([^:]{2,100}):/);parent=match?match[1]:'';}active=null;}}
  for(let i=0;i<rows.length;i++){
    const row=rows[i],mark=row.text.match(bullet);
    if(row.marker){finish();continue;}
    const activeText=active?page.text.slice(active.start,active.end):'';
    // "● Gram Stain (Urethral Discharge from / Symptomatic Males):" is one label wrapped over two lines.
    const closesLabel=!mark&&!!active&&!activeText.includes(':')&&!balanced(activeText)&&/^[^:(]*\)\s*:/.test(row.text);
    const standalone=!mark&&!closesLabel&&/^[A-Z][^:]{1,99}:\s*\S/.test(row.text)&&(!active||/[.!?]$/.test(rows[i-1]?.text||'')||/^Note:/.test(row.text));
    const followedByBullet=bullet.test(rows[i+1]?.text||'');
    const isHeading=!mark&&!closesLabel&&((taxonHeading(row.text)&&followedByBullet)||(/^[A-Z][a-z]{3,}$/.test(row.text)&&followedByBullet)||(heading(row.text)&&(!active||followedByBullet||genericSection.test(row.text)||/[.!?:)]$/.test(rows[i-1]?.text||''))));
    if(mark||standalone){
      finish();
      const nested=mark&&/[○◦]/.test(mark[1]);
      active={index:i,start:row.start,end:row.end,section,parent:nested?parent:'',nested,first:row.text.replace(bullet,'')};
      if(!nested) parent='';
      const label=active.first.match(/^([^:]{2,100}):/);
      if(!nested&&label)parent=compact(label[1]);
      // An unbulleted "Label: ...:" line introduces the bullets below it, so it replaces the previous section.
      if(!mark&&label&&/:$/.test(row.text))section=compact(label[1]);
    } else if(isHeading||!active){
      finish();section=isHeading||!fragment(row.text)?compact(row.text.replace(/:$/,'')):'';parent='';
    } else {
      active.end=row.end;
    }
  }
  finish();
  const drafts=[];
  for(const block of blocks){
    const quote=page.text.slice(block.start,block.end);
    const joined=compact(quote.replace(bullet,''));
    const match=joined.match(/^([^:]{2,100}):\s*(.+)$/);
    if(!match) continue;
    // PDF extraction leaves gaps before punctuation ("gonorrhoeae , which"); tidy the answer only, the quote stays verbatim.
    const label=match[1].trim(),answer=match[2].trim().replace(/\s+([,.;:!?)\]”])/g,'$1').replace(/([(\[“])\s+/g,'$1');
    // A dangling introduction or mangled mathematical text is not a complete recall unit.
    if(answer.length<3||answer.length>1600||/[:;,]$/.test(answer)||/\$|\\text|[\u{1D400}-\u{1D7FF}]/u.test(joined)||/^(?:note|e\.g\.|i\.e\.)$/i.test(label)||!balanced(label))continue;
    // A question the lecture poses (ending "…Why?") has no answer in the source.
    if(/\?\s*$/.test(answer))continue;
    const parentGeneric=!!block.parent&&(genericLabel.test(block.parent)||procedural(block.parent));
    let scope,missingContext,literal=false,shown=label;
    if(parentGeneric){
      // A nested bullet under a generic parent ("Morphology:") is only meaningful with the section that names its topic.
      const grounded=namesOrganism(label)||usable(block.section)&&!procedural(block.section)&&!genericLabel.test(block.section);
      missingContext=!grounded;scope=grounded?(namesOrganism(label)?block.parent:`${block.section} — ${block.parent}`):'';literal=true;shown=`${block.parent} — ${label}`;
    } else {
      const context=block.parent||block.section;
      const usableContext=usable(context);
      missingContext=genericLabel.test(label)&&!(usableContext&&!genericSection.test(context));
      // A sub-bullet whose parent is unreadable, or a vague label with no topic at all, cannot be placed.
      if(block.nested&&block.parent&&!usable(block.parent))missingContext=true;
      scope=usableContext?context:'';
      if(!scope&&!selfNamed(label))missingContext=true;
      // Under a procedure-only heading the card must name its organism itself, or the reader cannot tell which one it is about.
      if(scope&&procedural(scope)&&!namesOrganism(label)){if(!missingContext)shown=`${scope} — ${label}`;missingContext=true;}
    }
    // The answer may be cut off by a page break; keep it out of practice until checked.
    const continues=block.end===lastContent?.end&&continuesOnNextPage(nextPageText);
    const needsContext=missingContext||continues;
    if(needsContext&&!includeAmbiguous)continue;
    drafts.push({
      id:`draft-${page.id}-${block.index}`, subjectId,
      prompt:missingContext?`For [add organism/topic], what does the source describe under “${shown}”?`:recallQuestion(label,scope,answer,literal),
      answer,documentId:page.documentId,page:page.number,quote,
      verified:false,verifiedAt:null,due:0,interval:0,kind:'flashcard',options:[],
      generationVersion:3,needsContext,...(continues?{reviewNote:CONTINUES_NOTE}:{}),updatedAt:Date.now(),
    });
  }
  return drafts.slice(0,60);
}

export const legacyDraft = card => card.id.startsWith('draft-') && !card.generationVersion;
export const needsReview = card => !card.verified || !!card.needsContext || legacyDraft(card) || brokenQuestion(card);
