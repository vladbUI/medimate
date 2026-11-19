import React, { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  House,
  Layers,
  Timer,
  Settings,
  FileText,
  ArrowRight,
  Plus,
  Upload,
  ShieldCheck,
  Check,
  ChevronRight,
  Download,
  Pause,
  Play,
  Heart,
  WifiOff,
  FlaskConical,
} from "lucide-react";
import { db, uid, exportBackup, inspectImport, importBackup, approveDrafts, rebuildLegacyDrafts, repairGeneratedDrafts, addAcceptedAnswer } from "./db";
import {
  coverage,
  eligible,
  nextReview,
  normalize,
  schemas,
  currentSessionCard,
  reviewStatus,
  gradeResponse,
  cleanAcceptedAnswers,
  practicePool,
  encouragement,
  sessionCheer,
} from "./model";
import {legacyDraft, needsReview, brokenQuestion} from './sourceRecall';
import { addPDF, extractPDF } from "./pdf";
import PdfPreview from './PdfPreview';
import { renameSubject, removeEmptySubject, updateDocument, removeDocument, generateDocumentDrafts, copyAsQuestion } from './libraryActions';

const nav = [
  ["Today", House],
  ["Transes", FileText],
  ["Review", ShieldCheck],
  ["Flashcards", Layers],
  ["Quizzes", BookOpen],
  ["Moving exam", Timer],
  ["Settings", Settings],
];
const download = (data, name) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function Empty({ title, children }) {
  return (
    <div className="empty">
      <BookOpen size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Button({ children, ...props }) {
  return (
    <button className="primary" {...props}>
      {children}
    </button>
  );
}
function Field({ label, children }) {
  const id = React.useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, { id })}
    </div>
  );
}

export default function App() {
  const [tab, changeTab] = useState("Today"),
    [message, setMessage] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine),
    [ready, setReady] = useState(false);
  const setTab = next => { if(window.dispatchEvent(new Event('medimate-navigate',{cancelable:true}))) {changeTab(next);window.scrollTo(0,0);} };
  const data = useLiveQuery(
    async () => ({
      subjects: await db.subjects.toArray(),
      documents: await db.documents.toArray(),
      pages: await db.pages.toArray(),
      cards: await db.cards.toArray(),
      attempts: await db.attempts.toArray(),
      profile: await db.settings.get("profile"),
    }),
    [],
  );
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine),
      cached = () => setReady(true);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("medimate-offline-ready", cached);
    navigator.serviceWorker?.ready.then(() => setReady(true));
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("medimate-offline-ready", cached);
    };
  }, []);
  const run = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      setMessage(e.message || "Something went wrong. Please try again.");
      return null;
    }
  };
  if (!data) return <main>Opening your study space…</main>;
  const attention = data.cards.filter((c) => !eligible(c, data.pages)).length;
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Today");
          }}
        >
          <span className="brand-mark">
            <Heart size={22} />
          </span>
          MediMate<span className="brand-dot">.</span>
        </a>
        <p className="tagline">A little closer to RMT.</p>
        <nav aria-label="Main navigation">
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              aria-label={name}
              aria-current={tab === name ? 'page' : undefined}
              className={tab === name ? "selected" : ""}
              onClick={() => {
                setTab(name);
                setMessage("");
              }}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Review" && attention > 0 && (
                <span className="nav-count">
                  {attention}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="privacy">
          <ShieldCheck size={22} />
          <strong>Your space. Your pace.</strong>
          <p>
            Saved on this device.
            <br />
            Local mode · ₱0/month
          </p>
        </div>
        <button className="profile" onClick={() => setTab("Settings")}>
          <span>{data.profile.name.slice(0, 1)}</span>
          <div>
            {data.profile.name}
            <small>Personal study space</small>
          </div>
          <ChevronRight size={16} />
        </button>
      </aside>
      <div className="content">
        <header>
          <select className="mobile-navigation" aria-label="Go to section" value={tab} onChange={e=>setTab(e.target.value)}>{nav.map(([name])=><option key={name}>{name}</option>)}</select>
          <span>
            My study space <ChevronRight size={14} /> {tab}
          </span>
          <span className="status">
            {offline ? <WifiOff size={14} /> : <span className="dot" />}
            {offline ? "Offline" : ready ? "Offline ready" : "Local mode"}
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-title">
            <h1>{tab === "Today" ? `Hello, ${data.profile.name}.` : tab}</h1>
            <p>
              {
                {
                  Today: data.profile.goal,
                  Transes: "Your lectures, with every page accounted for.",
                  Review: "Check the source. Build a study bank you trust.",
                  Flashcards: "One question. A moment to remember.",
                  Quizzes: "Practice with verified questions and flashcards.",
                  "Moving exam": "Stay focused, then move to the next station.",
                  Settings: "Make this space feel like yours.",
                }[tab]
              }
            </p>
          </div>
          {message && (
            <div role="alert" className="notice">
              <span>{message}</span>
              <button
                onClick={() => setMessage("")}
                aria-label="Dismiss message"
              >
                Dismiss
              </button>
            </div>
          )}
          {tab === "Today" && <Dashboard data={data} go={setTab} />}
          {tab === "Transes" && (
            <Library data={data} run={run} notify={setMessage} />
          )}
          {tab === "Review" && (
            <Review data={data} run={run} notify={setMessage} go={setTab} />
          )}
          {tab === "Flashcards" && <Flashcards data={data} run={run} go={setTab} />}
          {["Quizzes", "Moving exam"].includes(tab) && (
            <Exam
              key={tab}
              data={data}
              moving={tab === "Moving exam"}
              run={run}
              go={setTab}
            />
          )}
          {tab === "Settings" && (
            <Preferences data={data} run={run} notify={setMessage} />
          )}
          <footer>
            <Heart size={13} /> Made for steady progress. Educational study aid;
            verify against your course sources.
          </footer>
        </main>
      </div>
    </div>
  );
}
function Dashboard({ data, go }) {
  const verified = data.cards.filter((c) => eligible(c, data.pages));
  const due = verified.filter(
    (c) => c.kind === "flashcard" && c.due <= Date.now(),
  );
  const pending = data.cards.filter((c) => !eligible(c, data.pages));
  const today = data.attempts
    .filter(
      (a) => new Date(a.updatedAt).toDateString() === new Date().toDateString(),
    )
    .reduce((n, a) => n + a.total, 0);
  return (
    <>
      <section className="today-panel">
        <div>
          <span className="date">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <h2>
            A small session.
            <br />A stronger foundation.
          </h2>
          <p>
            {due.length
              ? `${due.length} verified flashcards are ready for another look.`
              : pending.length ? 'Your lecture drafts are waiting for a source check. Verify one to begin practicing.' : data.documents.length ? 'Build your next practice session from your saved lectures.' : "Start with a lecture. Turn what you learn into something you remember."}
          </p>
          <Button onClick={() => go(due.length ? "Flashcards" : pending.length ? "Review" : "Transes")}>
            {due.length ? "Start reviewing" : pending.length ? "Check your drafts" : data.documents.length ? "Open your transes" : "Add your first trans"}
            <ArrowRight size={17} />
          </Button>
        </div>
        <div className="study-note">
          <FlaskConical size={30} />
          <span>Today’s intention</span>
          <strong>
            {data.profile.dailyTarget} questions, <br />
            at your own pace.
          </strong>
          <div className="progress">
            <i
              style={{
                width: `${Math.min(100, (today / data.profile.dailyTarget) * 100)}%`,
              }}
            />
          </div>
          <small>
            {today} / {data.profile.dailyTarget} practiced today
          </small>
        </div>
      </section>
      <div className="section-head">
        <h2>Your subjects</h2>
        <button onClick={() => go("Transes")}>
          Manage subjects <ArrowRight size={15} />
        </button>
      </div>
      <div className="subject-list">
        {data.subjects.map((s, i) => (
          <button key={s.id} onClick={() => go("Transes")}>
            <span className={`subject-symbol tone-${i % 3}`}>
              <BookOpen size={22} />
            </span>
            <span>
              <strong>{s.name}</strong>
              <small>
                {data.documents.filter((d) => d.subjectId === s.id).length}{" "}
                transes · {verified.filter((c) => c.subjectId === s.id).length}{" "}
                verified items
              </small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
      <section className="next-step">
        <ShieldCheck size={28} />
        <div>
          <h3>
            {pending.length
              ? `${pending.length} drafts need your eyes`
              : "Good study habits start at the source."}
          </h3>
          <p>
            {pending.length
              ? "Compare each answer with its lecture page before studying."
              : "Upload a trans, inspect the extracted pages, then verify your questions."}
          </p>
        </div>
        <button onClick={() => go(pending.length ? "Review" : "Transes")}>
          {pending.length ? "Review drafts" : "Open transes"}
          <ArrowRight size={16} />
        </button>
      </section>
      <div className="section-head">
        <h2>Recent practice</h2>
      </div>
      {data.attempts.length ? (
        <div className="history">
          {[...data.attempts]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 5)
            .map((a) => (
              <div key={a.id}>
                <strong>
                  {a.mode === "moving"
                    ? "Moving exam"
                    : a.mode === "quiz"
                      ? "Quiz"
                      : "Flashcards"}
                </strong>
                <span>
                  {a.score} / {a.total}{" "}
                  {a.mode === "flashcard" ? "remembered" : "correct"}
                </span>
                <small>{new Date(a.updatedAt).toLocaleDateString()}</small>
              </div>
            ))}
        </div>
      ) : (
        <p className="muted">
          Your completed sessions will appear here. There’s no rush to begin.
        </p>
      )}
    </>
  );
}

function Library({ data, run, notify }) {
  const [subjectName, setSubjectName] = useState(null);
  const [documentEdit, setDocumentEdit] = useState(null);
  const [subject, setSubject] = useState(""),
    [name, setName] = useState(""),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [pageNo, setPageNo] = useState(1),
    [pdfUrl, setPdfUrl] = useState("");
  const stop = useRef(false);
  const selectedSubject = subject || data.subjects[0]?.id || "";
  const doc = data.documents.find((d) => d.id === selected);
  const pages = data.pages
    .filter((p) => p.documentId === selected)
    .sort((a, b) => a.number - b.number);
  const page = pages.find((p) => p.number === pageNo);
  const cov = doc ? coverage(pages, doc.total) : null;
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );
  useEffect(() => {
    let cancelled = false,
      url = "";
    setPdfUrl("");
    if (selected)
      db.files.get(selected).then((f) => {
        if (f && !cancelled) {
          url = URL.createObjectURL(f.blob);
          setPdfUrl(url);
        }
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selected]);
  const process = async (id, retry = false) => {
    stop.current = false;
    setBusy(true);
    try {
      await run(() =>
        extractPDF(id, { retry, shouldStop: () => stop.current }),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="toolbar">
        <Field label="Subject">
          <select
            value={selectedSubject}
            disabled={busy}
            onChange={(e) => {
              setSubject(e.target.value);
              setSelected("");
              setSubjectName(null);
              setDocumentEdit(null);
            }}
          >
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const s = { id: uid(), name: name.trim(), updatedAt: Date.now() };
              schemas.subjects.parse(s);
              await db.subjects.add(s);
              setSubject(s.id);
              setName("");
            });
          }}
        >
          <Field label="New subject">
            <input
              placeholder="e.g. Histopathology"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <button aria-label="Add subject" disabled={busy}>
            <Plus size={19} />
          </button>
        </form>
      </section>
      <div className="actions management">
        {subjectName !== null ? <form className="inline-form" onSubmit={e=>{e.preventDefault();run(async()=>{await renameSubject(selectedSubject,subjectName);setSubjectName(null);notify('Subject renamed.');});}}><input aria-label="Subject name" required maxLength={100} value={subjectName} onChange={e=>setSubjectName(e.target.value)}/><button>Save subject</button><button type="button" onClick={()=>setSubjectName(null)}>Cancel</button></form> : <button disabled={busy || !selectedSubject} onClick={()=>setSubjectName(data.subjects.find(s=>s.id===selectedSubject)?.name || '')}>Rename subject</button>}
        <button disabled={busy || !selectedSubject || data.documents.some(d=>d.subjectId===selectedSubject) || data.cards.some(c=>c.subjectId===selectedSubject)} title="Only empty subjects can be removed" onClick={()=>run(async()=>{if(!confirm('Remove this empty subject?'))return;await removeEmptySubject(selectedSubject);setSubject('');notify('Empty subject removed.');})}>Remove empty subject</button>
      </div>
      <div className="upload">
        <FileText size={32} />
        <div>
          <h3>Bring your transes along.</h3>
          <p>PDF · up to 50 MB · stays on this device</p>
        </div>
        <label className={`primary file-button ${busy ? "disabled" : ""}`}>
          <Upload size={17} />
          Import PDF
          <input
            aria-label="Import PDF"
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy || !selectedSubject}
            onChange={(e) => {
              const file = e.target.files[0];
              e.target.value = "";
              if (file) {
                setBusy(true);
                run(async () => {
                  const id = await addPDF(file, selectedSubject);
                  setSelected(id);
                  setPageNo(1);
                  await process(id);
                }).finally(() => setBusy(false));
              }
            }}
          />
        </label>
      </div>
      <p className="muted small">
        Text extraction is not OCR. Images, tables, and diagrams always need a
        visual check against the original PDF.
      </p>
      <div className="document-list">
        {data.documents
          .filter((d) => d.subjectId === selectedSubject)
          .map((d) => {
            const c = coverage(
              data.pages.filter((p) => p.documentId === d.id),
              d.total,
            );
            return (
              <button
                key={d.id}
                disabled={busy}
                className={selected === d.id ? "active" : ""}
                onClick={() => {
                  setSelected(d.id);
                  setDocumentEdit(null);
                  setPageNo(1);
                }}
              >
                <FileText size={21} />
                <span>
                  <strong>{d.name}</strong>
                  <small>
                    {c.attempted}/{d.total} attempted · {c.extracted} with text
                    · {c.flagged} flagged
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            );
          })}
      </div>
      {doc && (
        <section className="panel">
          <div className="section-head">
            <h2>{doc.name}</h2>
            <div className="actions">
              {busy ? (
                <button
                  onClick={() => {
                    stop.current = true;
                  }}
                >
                  <Pause size={16} />
                  Pause after page
                </button>
              ) : (
                <>
                  <button disabled={!cov.remaining} onClick={() => process(doc.id)}>
                    <Play size={16} />
                    {cov.remaining ? 'Resume extraction' : 'Extraction complete'}
                  </button>
                  <button disabled={!cov.flagged} onClick={() => process(doc.id, true)}>
                    Retry flagged
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="actions management">
            <Button disabled={busy || !pages.length} onClick={()=>run(async()=>{const result=await generateDocumentDrafts(doc.id);notify(`${result.added} drafts added to Review · ${result.existing} existing items preserved · ${result.withoutDrafts} pages need manual questions · ${result.pending} pages pending extraction.${result.flagged?` ${result.flagged} new drafts are flagged: add their topic or check a page break before they can be verified.`:''}`);})}>Create drafts from all pages</Button>
            <button disabled={busy} onClick={()=>setDocumentEdit({name:doc.name,subjectId:doc.subjectId})}>Rename / move PDF</button>
            <button disabled={busy} onClick={()=>run(async()=>{const count=data.cards.filter(c=>c.documentId===doc.id).length;if(!confirm(`Remove ${doc.name}, its extracted pages, and ${count} study items? Past results remain. Export a backup first if you need these items.`))return;await removeDocument(doc.id);setSelected('');setDocumentEdit(null);notify('PDF and its study items removed.');})}>Remove PDF</button>
          </div>
          {documentEdit && <form className="panel form-grid" onSubmit={e=>{e.preventDefault();run(async()=>{await updateDocument(doc.id,documentEdit.name,documentEdit.subjectId);setSubject(documentEdit.subjectId);setDocumentEdit(null);notify('PDF details saved. Related study items moved with it.');});}}><Field label="PDF name"><input required maxLength={240} value={documentEdit.name} onChange={e=>setDocumentEdit({...documentEdit,name:e.target.value})}/></Field><Field label="Move to subject"><select value={documentEdit.subjectId} onChange={e=>setDocumentEdit({...documentEdit,subjectId:e.target.value})}>{data.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><div className="actions"><button disabled={busy}>Save PDF details</button><button type="button" onClick={()=>setDocumentEdit(null)}>Cancel</button></div></form>}
          <div className="coverage">
            <strong>
              {cov.attempted} / {doc.total} pages attempted
            </strong>
            <span>
              {cov.extracted} extracted · {cov.flagged} flagged ·{" "}
              {cov.remaining} pending
            </span>
            <progress value={cov.attempted} max={doc.total} />
          </div>
          <div className="actions management"><button disabled={pageNo<=1} onClick={()=>setPageNo(pageNo-1)}>Previous page</button><Field label="Jump to page"><select value={pageNo} onChange={e=>setPageNo(Number(e.target.value))}>{Array.from({length:doc.total},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></Field><button disabled={pageNo>=doc.total} onClick={()=>setPageNo(pageNo+1)}>Next page</button></div>
          <div className="page-selector">
            {Array.from({ length: doc.total }, (_, i) => {
              const p = pages.find((p) => p.number === i + 1);
              return (
                <button
                  key={i}
                  className={`${pageNo === i + 1 ? "current " : ""}${p?.status || "pending"}`}
                  onClick={() => setPageNo(i + 1)}
                  title={`Page ${i + 1}: ${p?.status || "pending"}`}
                  aria-label={`Page ${i + 1}: ${p?.status || "pending"}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="section-head">
            <h3>
              Page {pageNo}{" "}
              <span className={`badge ${page?.status === "extracted" ? "good" : ""}`}>{{extracted:"Text extracted","needs-review":"No text found",failed:"Extraction failed"}[page?.status] || "Pending"}</span>
            </h3>
            {pdfUrl && (
              <a
                href={`${pdfUrl}#page=${pageNo}`}
                target="_blank"
                rel="noreferrer"
              >
                View original PDF <ArrowRight size={14} />
              </a>
            )}
          </div>
          {page ? (
            <>
              <p className="warning">
                {page.error ||
                  "Text was extracted. Reading order, tables, and images may still be incomplete."}
              </p>
              <pre className="source-text">
                {page.text || "No extractable text."}
              </pre>
              <div className="actions">
                <button
                  onClick={() =>
                    run(() =>
                      db.pages.update(page.id, {
                        reviewed: !page.reviewed,
                        updatedAt: Date.now(),
                      }),
                    )
                  }
                >
                  {page.reviewed ? (
                    <Check size={17} />
                  ) : (
                    <ShieldCheck size={17} />
                  )}{" "}
                  {page.reviewed
                    ? "Visually reviewed"
                    : "Mark visually reviewed"}
                </button>
                <button
                  disabled={!page.text || busy}
                  onClick={() =>
                    run(async () => {
                      const { added, flagged } = await generateDocumentDrafts(doc.id, { pageNumber: page.number });
                      notify(
                        added
                          ? `${added} source-recall drafts added to Review. Complete bullets are preserved; check context before verification.${flagged ? ` ${flagged} are flagged: add their topic or check a page break before they can be verified.` : ""}`
                          : "No new complete notes found on this page. Image tables and fragments need a manual question in Review.",
                      );
                    })
                  }
                >
                  Create source-recall drafts
                </button>
              </div>
            </>
          ) : (
            <p>
              Resume extraction to read this page. Previously saved pages will
              be kept.
            </p>
          )}
        </section>
      )}
      {!data.documents.some(d=>d.subjectId===selectedSubject) && (
        <Empty title="Your library starts here">
          Choose a subject and import a lecture PDF. Every page gets a place in
          your coverage tracker.
        </Empty>
      )}
    </>
  );
}

const freshCard = (subjectId = "", documentId = "", page = 1) => ({
  id: uid(),
  subjectId,
  documentId,
  page,
  prompt: "",
  answer: "",
  quote: "",
  kind: "flashcard",
  options: [],
  verified: false,
  verifiedAt: null,
  due: 0,
  interval: 0,
  updatedAt: Date.now(),
});
function Review({ data, run, notify, go }) {
  const [contextOnly,setContextOnly]=useState(false), [sourceUrl,setSourceUrl]=useState('');
  const original = useRef('');
  const [search,setSearch]=useState(''), [reviewSubject,setReviewSubject]=useState(''), [kind,setKind]=useState('');
  const pending=c=>!eligible(c,data.pages);
  const editorRef=useRef(null);
  const [accepted,setAccepted]=useState(''), [confirmed,setConfirmed]=useState(false), [metaOpen,setMetaOpen]=useState(false);
  const matches=c=>(!contextOnly||c.needsContext||legacyDraft(c)||brokenQuestion(c))&&(!reviewSubject||c.subjectId===reviewSubject)&&(!kind||c.kind===kind)&&normalize(`${c.prompt} ${c.answer} ${data.documents.find(d=>d.id===c.documentId)?.name || ''}`).includes(normalize(search));
  const [approving, setApproving] = useState(false);
  const approvalLock = useRef(false);
  const drafts = data.cards.filter((card) => needsReview(card) && matches(card));
  const [edit, setEdit] = useState(null),
    [filter, setFilter] = useState("drafts"),
    [options, setOptions] = useState("");
  const docs = data.documents.filter((d) => d.subjectId === edit?.subjectId);
  const source = data.pages.find(
    (p) => p.documentId === edit?.documentId && p.number === Number(edit?.page),
  );
  const set = (key, value) => setEdit({ ...edit, [key]: value });
  useEffect(()=>{let cancelled=false,url='';setSourceUrl('');if(edit?.documentId)db.files.get(edit.documentId).then(file=>{if(file&&!cancelled){url=URL.createObjectURL(file.blob);setSourceUrl(url);}});return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};},[edit?.documentId]);
  const visible=data.cards.filter(c=>(filter==='all'||pending(c))&&matches(c));
  const position=visible.findIndex(c=>c.id===edit?.id);
  const load=c=>{setMetaOpen(!c.documentId||!c.prompt);const choices=c.options.join('\n'),variants=(c.acceptedAnswers||[]).join('\n');original.current=JSON.stringify([c,choices,variants]);setEdit({...c});setOptions(choices);setAccepted(variants);setConfirmed(false);};
  const nextItem=()=>visible.slice(position+1).find(c=>c.id!==edit?.id);
  const showNext=()=>{const next=nextItem();if(next)load(next);else{setEdit(null);notify('You reached the end of this filtered review list.');}};
  const dirty = !!edit && JSON.stringify([edit,options,accepted])!==original.current;
  // Bring the editor into view and move focus to it whenever a different item opens.
  useEffect(()=>{if(edit?.id&&editorRef.current){editorRef.current.scrollIntoView({block:'start'});editorRef.current.querySelector('h2')?.focus({preventScroll:true});}},[edit?.id]);
  const excerpt=edit?.quote.trim()||'';
  const excerptFound=!!excerpt&&!!source?.text.includes(excerpt);
  useEffect(()=>{
    const navigate=e=>{if(dirty&&!confirm('Discard unsaved changes to this study item?'))e.preventDefault();};
    const unload=e=>{if(dirty){e.preventDefault();e.returnValue='';}};
    window.addEventListener('medimate-navigate',navigate);window.addEventListener('beforeunload',unload);
    return ()=>{window.removeEventListener('medimate-navigate',navigate);window.removeEventListener('beforeunload',unload);};
  },[dirty]);
  const open = (c) => {
    if(dirty&&!confirm('Discard unsaved changes to this study item?'))return;
    load(c);
  };
  async function approveAll() {
    if (approvalLock.current || edit || !drafts.length) return;
    const ids = drafts.map((card) => card.id);
    if (!confirm(`Approve all ${ids.length} saved drafts matching the current search and subject/type filters? Confirm that you have checked their answers against the original sources. Items with missing or invalid source references will stay in review.`)) return;
    approvalLock.current = true;
    setApproving(true);
    try {
      await run(async () => {
        const { approved, skipped } = await approveDrafts(ids);
        notify(`${approved} ${approved === 1 ? "draft approved" : "drafts approved"}.${skipped ? ` ${skipped} skipped because their source or content needs correction.` : " Ready to study."}`);
      });
    } finally {
      approvalLock.current = false;
      setApproving(false);
    }
  }
  async function save(verify,advance=false) {
    if (verify && brokenQuestion(edit)) throw Error('Replace the bullet/keyword definition with a complete question that names its topic.');
    const saved = await db.cards.get(edit.id);
    const flagged = !!saved && (legacyDraft(saved) || !!saved.needsContext);
    if (verify && flagged) {
      // A possible page-break truncation is resolved by completing the answer or explicitly confirming it.
      if (saved.reviewNote && !legacyDraft(saved)) {
        if (!confirmed && edit.answer.trim() === saved.answer.trim())
          throw Error('Complete the answer from the original PDF, or tick the box confirming it is already complete.');
      } else if (edit.prompt.trim() === saved.prompt.trim())
        throw Error('Rewrite the question to include its topic or organism before verifying this ambiguous draft.');
    }
    const choices = options.split("\n").map((x) => x.trim()).filter(Boolean);
    const variants = cleanAcceptedAnswers(accepted.split("\n"), edit.answer);
    if (variants.length && choices.length)
      throw Error('Accepted answers apply to typed answers only. Remove them, or remove the multiple-choice options.');
    if (variants.length > 20) throw Error('Keep at most 20 accepted answers.');
    const { reviewNote, acceptedAnswers: _previousVariants, ...rest } = edit;
    const c = {
      ...rest,
      ...(variants.length ? { acceptedAnswers: variants } : {}),
      ...(reviewNote && !verify ? { reviewNote } : {}),
      page: Number(edit.page),
      quote: edit.quote.trim(),
      options: choices,
      verified: verify,
      generationVersion: 3,
      userEdited: true,
      needsContext: !verify && flagged,
      verifiedAt: verify ? Date.now() : null,
      updatedAt: Date.now(),
    };
    schemas.cards.parse(c);
    if (!source || !source.text.includes(c.quote))
      throw Error("Paste an exact excerpt from the extracted source page.");
    if (
      c.options.length &&
      (c.kind !== "question" ||
        c.options.length < 2 ||
        !c.options.includes(c.answer) ||
        new Set(c.options).size !== c.options.length)
    )
      throw Error(
        "Use at least two distinct choices and make the answer match one exactly, or leave choices empty.",
      );
    await db.cards.put(c);
    if(advance)showNext();else setEdit(null);
    notify(
      verify
        ? "Verified against your source. Ready to study."
        : "Draft saved. It is excluded from study sessions until verified.",
    );
  }
  return (
    <>
      {!edit && <section className="practice-readiness" aria-label="Practice readiness"><div><h2>Your next practice session</h2><p>{data.cards.length-data.cards.filter(pending).length} verified items · {data.cards.filter(pending).length} need review</p><p className="small muted">Verify a complete question against its source. Quizzes and moving exams can use verified questions or flashcards.</p></div><div className="actions"><button onClick={()=>go('Quizzes')}>Open quizzes <ArrowRight size={15}/></button><button onClick={()=>go('Moving exam')}>Open moving exam <ArrowRight size={15}/></button></div></section>}
      <details className="review-guidance" hidden={!!edit}><summary>How to check a source-based draft</summary><p>Local drafts recall what the source says; they do not interpret keyword lists or validate medical facts. Image tables are not read. Ambiguous or older generated items stay out of practice until corrected.</p></details>
      {data.cards.some(legacyDraft) && <section className="notice">
        <span>Older drafts may contain truncated bullets or misleading definition questions. Rebuild them from the saved source text; the previous wording will be kept for comparison.</span>
        <button disabled={!!edit || approving} onClick={()=>run(async()=>{
          if(!confirm('Rewrite older automatic drafts using complete source bullets? They will return to review. Ambiguous items will need individual editing. Original wording is kept.')) return;
          const result=await rebuildLegacyDrafts();
          notify(`${result.rewritten} drafts rewritten. ${result.flagged} need topic/context added manually. Review before approving.`);
        })}>Rebuild older drafts</button>
      </section>}
      <div className="review-bar">
        <div className="tabs">
          <button
            className={filter === "drafts" ? "active" : ""}
            aria-pressed={filter === "drafts"}
            onClick={() => setFilter("drafts")}
          >
            Needs review ({data.cards.filter(pending).length})
          </button>
          <button
            className={filter === "all" ? "active" : ""}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All items
          </button>
        </div>
        <Button
          onClick={() =>
            open(
              freshCard(
                data.subjects[0]?.id,
                data.documents.find((d) => d.subjectId === data.subjects[0]?.id)
                  ?.id,
              ),
            )
          }
        >
          <Plus size={17} />
          Add item
        </Button>
      </div>
      <div className="toolbar review-filters"><Field label="Search study items"><input type="search" placeholder="Question, answer, or PDF name" value={search} onChange={e=>setSearch(e.target.value)}/></Field><SubjectFilter data={data} value={reviewSubject} set={setReviewSubject}/><Field label="Item type"><select value={kind} onChange={e=>setKind(e.target.value)}><option value="">All types</option><option value="flashcard">Flashcards</option><option value="question">Quiz questions</option></select></Field><label className="check"><input type="checkbox" checked={contextOnly} onChange={e=>setContextOnly(e.target.checked)}/>Needs context only</label>{(search||reviewSubject||kind)&&<button onClick={()=>{setSearch('');setReviewSubject('');setKind('');}}>Clear filters</button>}</div>
      {!edit && <div className="bulk-actions">
        <button
          disabled={approving || !drafts.length}
          onClick={approveAll}
          title="Approve saved drafts matching the search and subject/type filters"
        >
          <ShieldCheck size={17} />
          {approving ? "Approving…" : `Approve all drafts (${drafts.length})`}
        </button>
        <button disabled={approving} onClick={()=>run(async()=>{const result=await repairGeneratedDrafts();notify(`${result.repaired} drafts restored from complete source bullets. ${result.flagged} still need context. Existing wording is kept for comparison; nothing was approved or deleted.`);})}>Repair incomplete drafts</button>
      </div>}
      {edit && (
        <section className="panel editor" ref={editorRef} aria-labelledby="editor-title">
          <h2 id="editor-title" tabIndex={-1}>
            {data.cards.some((c) => c.id === edit.id)
              ? "Review study item"
              : "New study item"}
          </h2>
          {position >= 0 && <p className="editor-position">Item {position + 1} of {visible.length} in this list</p>}
          <details className="item-meta" open={metaOpen} onToggle={(e) => setMetaOpen(e.currentTarget.open)}>
          <summary>{docs.find((d) => d.id === edit.documentId)?.name || "Choose a source trans"} · p. {edit.page} · {edit.kind === "question" ? "quiz question" : "flashcard"} <span>Change</span></summary>
          <div className="form-grid">
            <Field label="Subject">
              <select
                value={edit.subjectId}
                onChange={(e) => {
                  setEdit({
                    ...edit,
                    subjectId: e.target.value,
                    documentId: "",
                    quote: "",
                  });
                }}
              >
                <option value="">Choose subject</option>
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Study type">
              <select
                value={edit.kind}
                onChange={(e) => {
                  set("kind", e.target.value);
                  setOptions("");
                }}
              >
                <option value="flashcard">Flashcard</option>
                <option value="question">Quiz / moving exam question</option>
              </select>
            </Field>
            <Field label="Source trans">
              <select
                value={edit.documentId}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    documentId: e.target.value,
                    page: 1,
                    quote: "",
                  })
                }
              >
                <option value="">Choose a trans</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source page">
              <input
                type="number"
                min="1"
                max={docs.find((d) => d.id === edit.documentId)?.total || 3000}
                value={edit.page}
                onChange={(e) => set("page", e.target.value)}
              />
            </Field>
          </div>
          </details>
          <div className="review-workspace"><div className="review-source">
          <h3>Compare with the source</h3>
          {sourceUrl?<><a href={`${sourceUrl}#page=${edit.page}`} target="_blank" rel="noreferrer">Open original PDF · page {edit.page}</a><PdfPreview url={sourceUrl} page={edit.page}/></>:<p className="warning">Original PDF is unavailable. Reimport it in Transes to check visual context.</p>}
          <details open>
            <summary>Extracted text · page {edit.page}</summary>
            <SourceText text={source?.text || ""} quote={excerpt} page={edit.page} />
          </details>
          </div><div className="review-fields">
          {(legacyDraft(edit)||edit.needsContext)&&(edit.reviewNote&&!legacyDraft(edit)&&!brokenQuestion(edit)
            ? <div className="warning"><p>{edit.reviewNote}</p><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I compared this with the original PDF; the answer is complete.</label></div>
            : <p className="warning">Add the organism/topic and rewrite this question from the original PDF. Its context is unclear; bulk approval cannot resolve it.{edit.reviewNote?` ${edit.reviewNote}`:''}</p>)}
          {reviewStatus(edit,data.pages)==='stale'&&<p className="warning">This item was verified, but its excerpt no longer matches the saved source page. It stays out of practice until you correct the excerpt and verify again.</p>}
          {edit.previousDraft&&<details><summary>Previous generated wording (kept for comparison)</summary><p>{edit.previousDraft.prompt}</p><blockquote>{edit.previousDraft.answer}</blockquote></details>}
          <Field label="Exact source excerpt">
            <textarea
              value={edit.quote}
              onChange={(e) => set("quote", e.target.value)}
              placeholder="Copy the supporting sentence from the extracted text."
            />
          </Field>
          <p className={`excerpt-check ${excerptFound ? "found" : ""}`} role="status">
            {excerptFound ? <><Check size={15} aria-hidden="true" /> Excerpt found on page {edit.page} and highlighted in the extracted text.</> : excerpt ? `Excerpt not found on page ${edit.page}. Copy it exactly from the extracted text, or correct the page number.` : "Add an exact excerpt from the extracted text to link this item to its source."}
          </p>
          <Field label="Question">
            <textarea
              value={edit.prompt}
              onChange={(e) => set("prompt", e.target.value)}
            />
          </Field>
          <Field label="Answer">
            <textarea
              value={edit.answer}
              onChange={(e) => set("answer", e.target.value)}
            />
          </Field>
          <Field label="Also accept these typed answers (optional, one per line)">
            <textarea
              value={accepted}
              onChange={(e) => setAccepted(e.target.value)}
              placeholder="e.g. an abbreviation or alternate spelling used in your lecture"
            />
          </Field>
          <p className="small muted field-help">
            Quizzes mark a typed answer correct only when it matches the answer or a line here, ignoring capitals, spacing, and closing punctuation. Nothing else is accepted automatically, so list only variants your lecture supports.
          </p>
          {edit.kind === "question" && (
            <Field label="Optional multiple-choice answers (one per line, including the exact correct answer)">
              <textarea
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            </Field>
          )}
          <p className="warning">
            Verification means you checked the answer against this excerpt and
            the original lecture. It is not independent medical validation.
            Editing a verified item and saving a draft removes verification.
          </p>
          <div className="actions">
            <Button onClick={()=>run(()=>save(true,true))}>Verify & next <ArrowRight size={17}/></Button>
            <button className="soft" onClick={() => run(() => save(true))}>
              <ShieldCheck size={17} />
              Verify & save
            </button>
            <button onClick={() => run(() => save(false))}>
              Save as draft
            </button>
            <button onClick={()=>run(()=>save(false,true))}>Save draft & next</button>
            <button className="plain" onClick={()=>{if(!dirty||confirm('Discard these unsaved edits and skip to the next item?'))showNext();}}>Skip</button>
            <button className="plain" onClick={() => {if(!dirty||confirm('Discard unsaved changes to this study item?'))setEdit(null);}}>Cancel</button>
          </div>
          </div></div>
        </section>
      )}
      <div className="review-list">
        {visible.map((c) => (
            <article key={c.id}>
              <span className={`badge ${!pending(c) ? "good" : ""}`}>
                {{legacy:"Older draft — rewrite needed",context:c.reviewNote&&!brokenQuestion(c)?"Check page break — edit individually":"Context needed — edit individually",draft:"Needs review",stale:"Source changed — re-check excerpt",verified:"Verified"}[reviewStatus(c,data.pages)]}
              </span>
              <h3>{c.needsContext || brokenQuestion(c) ? 'Incomplete question — add its topic in Review / edit' : c.prompt}</h3>
              <p className="answer-preview">{c.answer}</p>
              <p>
                {data.documents.find((d) => d.id === c.documentId)?.name} · p.{" "}
                {c.page} · {c.kind === "question" ? "quiz question" : "flashcard"}
              </p>
              <div className="actions">
                <button className="review-edit" onClick={() => open(c)}>
                  Review / edit <ArrowRight size={15} />
                </button>
                {c.kind==='flashcard'&&<button onClick={()=>run(async()=>{const result=await copyAsQuestion(c.id);notify(result.created?'Copied to the quiz question bank. Source and review status preserved.':'A quiz copy already exists. Choose All items and Quiz questions to find it.');})}>Copy to quiz bank</button>}
                <button className="danger-quiet"
                  onClick={() =>
                    run(async () => {
                      if (
                        confirm(
                          "Delete this study item? Past results will remain.",
                        )
                      )
                        await db.cards.delete(c.id);
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
      </div>
      {!!data.cards.length && !visible.length && <Empty title="No matching study items">Try All items or clear the search and filters. Verified items are available in practice.</Empty>}
      {!data.cards.length && !edit && (
        <Empty title="A trustworthy bank takes a little review">
          Create source-recall drafts from a trans, or add a question with its
          exact source excerpt. Only verified items enter practice.
        </Empty>
      )}
    </>
  );
}

// Extracted page text with the item's excerpt highlighted, so a reviewer can see exactly what supports the answer.
function SourceText({ text, quote, page }) {
  const box = useRef(null), mark = useRef(null);
  const at = quote ? text.indexOf(quote) : -1;
  useEffect(() => {
    if (box.current && mark.current)
      box.current.scrollTop += mark.current.getBoundingClientRect().top - box.current.getBoundingClientRect().top - 48;
  }, [text, quote]);
  return (
    <pre className="source-text" ref={box} tabIndex={0} role="region" aria-label={`Extracted text of page ${page}`}>
      {!text ? "No text on this page. Select an extracted page in your library." : at < 0 ? text : <>{text.slice(0, at)}<mark ref={mark}>{quote}</mark>{text.slice(at + quote.length)}</>}
    </pre>
  );
}
function SubjectFilter({ data, value, set }) {
  return (
    <Field label="Study subject">
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">All subjects</option>
        {data.subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Flashcards({ data, run, go }) {
  const rating = useRef(false);
  const [subject, setSubject] = useState(""),
    [all, setAll] = useState(false),
    [queue, setQueue] = useState(null),
    [revealed, setRevealed] = useState(false),
    [results, setResults] = useState([]);
  const cards = data.cards.filter(
    (c) =>
      c.kind === "flashcard" &&
      eligible(c, data.pages) &&
      (!subject || c.subjectId === subject) &&
      (all || c.due <= Date.now()),
  );
  const c = queue?.[0];
  const stale = !!queue?.some(snapshot=>!currentSessionCard(snapshot,data.cards,data.pages));
  const rate = (good) =>
    run(async () => {
      if (rating.current || stale || !c) return;
      rating.current = true;
      try {
        const row = {
          cardId: c.id,
          prompt: c.prompt,
          answer: c.answer,
          response: good ? "Remembered" : "Again",
          correct: good,
        };
        await db.transaction("rw", db.cards, db.pages, db.attempts, async () => {
          if (!currentSessionCard(c,await db.cards.toArray(),await db.pages.toArray())) throw Error('This card changed or needs review. Start a fresh session.');
          await db.cards.update(c.id, nextReview(c, good));
          await db.attempts.add({
            id: uid(),
            mode: "flashcard",
            score: good ? 1 : 0,
            total: 1,
            details: [row],
            updatedAt: Date.now(),
          });
        });
        setResults([...results, row]);
        setQueue(queue.slice(1));
        setRevealed(false);
      } finally {
        rating.current = false;
      }
    });
  return (
    <>
      <div className="toolbar">
        <SubjectFilter data={data} value={subject} set={setSubject} />
        <label className="check">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setAll(e.target.checked)}
          />{" "}
          Include cards not yet due
        </label>
      </div>
      {queue === null ? (
        <section className="session-intro">
          <Layers size={32} />
          <h2>{cards.length} cards ready for you</h2>
          <p>
            Recall the answer, reveal it, then tell yourself honestly how it
            went.
          </p>
          {!cards.length && <div className="practice-help"><p>{data.cards.some(c=>c.kind==='flashcard'&&eligible(c,data.pages)&&(!subject||c.subjectId===subject)) ? 'You’re caught up for now. Include cards scheduled for later to keep practicing.' : 'Flashcards appear here after you verify their question, answer, and source in Review.'}</p><div className="actions">{!all&&<button onClick={()=>setAll(true)}>Include scheduled cards</button>}<button onClick={()=>go('Review')}>Review study items</button>{subject&&<button onClick={()=>setSubject('')}>Show all subjects</button>}</div></div>}
          <Button
            disabled={!cards.length}
            onClick={() => {
              setQueue(cards.slice(0, 100));
              setResults([]);
            }}
          >
            Begin flashcards <ArrowRight size={17} />
          </Button>
        </section>
      ) : stale ? (
        <section className="session-intro"><h2>This session needs a fresh start.</h2><p>A card was corrected, removed, or returned to review. Its older wording will not be shown or scored.</p><Button onClick={()=>{setQueue(null);setRevealed(false)}}>Start a fresh session</Button></section>
      ) : c ? (
        <section className="study-card">
          <div className="section-head">
            <span>{queue.length} remaining</span>
            <span className="badge good">Verified source</span>
          </div>
          <h2>{c.prompt}</h2>
          {revealed ? (
            <>
              <div className="answer">{c.answer}</div>
              <details>
                <summary>Source · p. {c.page}</summary>
                <blockquote>{c.quote}</blockquote>
                <small>
                  {data.documents.find((d) => d.id === c.documentId)?.name}
                </small>
              </details>
              <div className="actions">
                <button onClick={() => rate(false)}>Again · 10 min</button>
                <Button onClick={() => rate(true)}>
                  Remembered <Check size={17} />
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => setRevealed(true)}>Reveal answer</Button>
          )}
          <button className="quiet" onClick={() => setQueue(null)}>
            End session
          </button>
        </section>
      ) : (
        <section className="session-intro">
          <Check size={32} />
          <h2>A little stronger than before.</h2>
          <p>
            {results.filter((r) => r.correct).length} / {results.length}{" "}
            remembered. Your review schedule is saved.
          </p>
          <button onClick={() => setQueue(null)}>Back to flashcards</button>
        </section>
      )}
    </>
  );
}

function Exam({ data, moving, run, go }) {
  const key = moving ? "medimate-moving" : "medimate-quiz";
  const [subject, setSubject] = useState(""),
    [includeFlashcards, setIncludeFlashcards] = useState(false),
    [seconds, setSeconds] = useState(60),
    [count, setCount] = useState(10),
    [session, setSession] = useState(() => {
      try {
        const s = JSON.parse(sessionStorage.getItem(key));
        return s && Array.isArray(s.cards) ? s : null;
      } catch {
        return null;
      }
    }),
    [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  const stale = !!session && !session.done && session.cards.some(snapshot=>!currentSessionCard(snapshot,data.cards,data.pages));
  useEffect(() => {
    if (session) sessionStorage.setItem(key, JSON.stringify(session));
    else sessionStorage.removeItem(key);
  }, [session, key]);
  useEffect(() => {
    if (!moving || !session || session.done || stale) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [moving, !!session, session?.done, stale]);
  const { flashcards: verifiedFlashcards, cards } = practicePool(data.cards, data.pages, { subject, includeFlashcards });
  const pendingItems = data.cards.filter(c=>!eligible(c,data.pages)&&(!subject||c.subjectId===subject)).length;
  const [added, setAdded] = useState({});
  const current = session?.cards[session.index];
  const sessionSize = Number.isInteger(+count)&&+count>0 ? Math.min(cards.length,+count,100) : null;
  async function advance(timedOut = false) {
    if (!session || session.done || busy.current || stale) return;
    busy.current = true;
    try {
      let s = { ...session, results: [...session.results] };
      do {
        const c = s.cards[s.index];
        const response = s.index === session.index ? s.response : "";
        s.results.push({
          cardId: c.id,
          prompt: c.prompt,
          answer: c.answer,
          response,
          ...gradeResponse(c, response),
        });
        s.index++;
        s.response = "";
        s.deadline = timedOut
          ? s.deadline + s.seconds * 1000
          : Date.now() + s.seconds * 1000;
      } while (
        moving &&
        timedOut &&
        s.index < s.cards.length &&
        Date.now() >= s.deadline
      );
      if (s.index >= s.cards.length) {
        s.done = true;
        await db.attempts.put({
          id: s.id,
          mode: moving ? "moving" : "quiz",
          total: s.cards.length,
          score: s.results.filter((r) => r.correct).length,
          details: s.results,
          updatedAt: Date.now(),
        });
      }
      setSession(s);
      setNow(Date.now());
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    if (moving && session && !session.done && now >= session.deadline)
      run(() => advance(true));
  }, [now, session?.deadline]);
  return (
    <>
      {!session ? (
        <>
          <div className="toolbar">
            <SubjectFilter data={data} value={subject} set={setSubject} />
            <Field label="Questions (up to 100)">
              <input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </Field>
            {moving && (
              <Field label="Seconds per station">
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                />
              </Field>
            )}
          </div>
          <label className="bank-option"><input type="checkbox" checked={includeFlashcards} onChange={e=>setIncludeFlashcards(e.target.checked)}/><span><strong>Use verified flashcards too</strong><small>{verifiedFlashcards.length} additional cards available. Practice directly without making quiz copies.</small></span></label>
          {!cards.length ? <section className="practice-empty">
            {moving ? <Timer size={32}/> : <BookOpen size={32}/>}
            <h2>{verifiedFlashcards.length ? 'Your flashcards are ready to use.' : pendingItems ? 'One source check away from practice.' : 'Build your first practice question.'}</h2>
            <p>{verifiedFlashcards.length ? `${verifiedFlashcards.length} verified flashcards can be used in this ${moving?'moving exam':'quiz'}. Enable them to start.` : pendingItems ? `${pendingItems} items ${subject?'in this subject ':''}still need review. Open a draft, correct any missing context, then choose Verify & save.` : 'Add a question with a supporting source excerpt in Review, or create drafts from a lecture PDF.'}</p>
            <div className="actions">{verifiedFlashcards.length>0 ? <Button onClick={()=>setIncludeFlashcards(true)}>Use verified flashcards <ArrowRight size={17}/></Button> : <Button onClick={()=>go(data.cards.length?'Review':'Transes')}>{data.cards.length?'Review study items':'Open transes'} <ArrowRight size={17}/></Button>}{subject&&<button onClick={()=>setSubject('')}>Show all subjects</button>}<button onClick={()=>go(verifiedFlashcards.length?'Review':data.cards.length?'Transes':'Review')}>{verifiedFlashcards.length?'Review study items':data.cards.length?'Open transes':'Add a question in Review'}</button></div>
            <p className="small muted">At least one verified item is enough. Drafts and items with missing context stay out of practice.</p>
          </section> : <>
          <section className="session-intro">
            {moving ? <Timer size={36} /> : <BookOpen size={36} />}
            <h2>
              {moving
                ? "Your next station starts here."
                : "Make room for a practice round."}
            </h2>
            <p>
              {cards.length} verified {includeFlashcards?'items':'questions'} available.{" "}
              {moving
                ? "Stations advance automatically; unanswered stations count as incorrect."
                : "Answers and source excerpts appear after the session."}
            </p>
            <p className="session-size" aria-live="polite">This session: {sessionSize ?? '—'} {moving ? sessionSize===1?'station':'stations' : sessionSize===1?'question':'questions'}{moving&&Number.isFinite(+seconds)&&+seconds>=10 ? ` · ${+seconds}s per station` : ''}</p>
            {(!Number.isInteger(+count)||+count<1||+count>100)&&<p role="alert" className="warning">Choose a whole number of questions from 1 to 100.</p>}
            {moving&&(!Number.isInteger(+seconds)||+seconds<10||+seconds>600)&&<p role="alert" className="warning">Choose a whole number of seconds from 10 to 600.</p>}
            <p className="muted small">
              Typed answers must match the answer or one of the accepted
              answers you listed in Review, ignoring capitals, spacing, and
              closing punctuation.
            </p>
            <Button
              disabled={
                !cards.length ||
                !Number.isInteger(+count) ||
                +count < 1 ||
                +count > 100 ||
                !Number.isInteger(+seconds) ||
                +seconds < 10 ||
                +seconds > 600
              }
              onClick={() => {
                const chosen = [...cards];
                for (let i = chosen.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
                }
                setSession({
                  id: uid(),
                  cards: chosen.slice(0, +count),
                  index: 0,
                  results: [],
                  response: "",
                  seconds: +seconds,
                  deadline: Date.now() + seconds * 1000,
                  done: false,
                });
                setNow(Date.now());
              }}
            >
              {moving ? "Start moving exam" : "Start quiz"}{" "}
              <ArrowRight size={17} />
            </Button>
          </section>
          </>}
        </>
      ) : stale ? (
        <section className="session-intro"><h2>This session contains outdated questions.</h2><p>A question changed or needs source review. Restart to use the current verified bank.</p><Button onClick={()=>setSession(null)}>Start a fresh session</Button></section>
      ) : session.done ? (
        <section className="panel">
          <h2>Session complete</h2>
          <p className="result-score">
            {session.results.filter((r) => r.correct).length} /{" "}
            {session.cards.length}
          </p>
          <p className={`answer-feedback ${session.results.every((r) => r.correct) ? "good" : ""}`} role="status">
            {session.results.every((r) => r.correct) ? <Check size={18} aria-hidden="true" /> : <Heart size={18} aria-hidden="true" />}
            {sessionCheer(data.profile.name, session.results.filter((r) => r.correct).length, session.cards.length)}
          </p>
          <p>Your results are saved on this device.</p>
          {session.results.map((r, i) => (
            <div className="result" key={i}>
              <span className={`badge ${r.correct ? "good" : ""}`}>
                {r.correct ? "Correct" : "Review"}
              </span>
              <h3>{r.prompt}</h3>
              <p>Your answer: {r.response || "No answer"}</p>
              <p>
                <strong>Expected: {r.answer}</strong>
              </p>
              {r.acceptedAs !== undefined && <p className="small muted">Counted through your accepted answer “{r.acceptedAs}”.</p>}
              {!r.correct && r.response.trim() && !session.cards[i].options.length && (added[i]
                ? <p className="small muted" role="status">Added. Future sessions will accept “{r.response.trim()}”. This session’s score is unchanged; edit accepted answers in Review.</p>
                : <button onClick={() => run(async () => { await addAcceptedAnswer(r.cardId, r.response); setAdded({ ...added, [i]: true }); })}>Accept my answer from now on</button>)}
              <blockquote>{session.cards[i].quote}</blockquote>
              <small>
                {
                  data.documents.find(
                    (d) => d.id === session.cards[i].documentId,
                  )?.name
                }{" "}
                · p. {session.cards[i].page}
              </small>
            </div>
          ))}
          <Button onClick={() => { setSession(null); setAdded({}); }}>New session</Button>
        </section>
      ) : (
        <section className="study-card">
          <div className="section-head">
            <span>
              {moving ? "Station" : "Question"} {session.index + 1} /{" "}
              {session.cards.length}
            </span>
            {moving && (
              <strong className="timer" role="timer">
                {Math.max(0, Math.ceil((session.deadline - now) / 1000))}s
              </strong>
            )}
          </div>
          <progress value={session.index} max={session.cards.length} />
          {session.results.length > 0 && (
            <p key={session.index} className={`answer-feedback ${session.results.at(-1).correct ? "good" : ""}`} role="status">
              {session.results.at(-1).correct ? <Check size={18} aria-hidden="true" /> : <Heart size={18} aria-hidden="true" />}
              {encouragement(data.profile.name, session.results.at(-1), session.index)}
            </p>
          )}
          <h2>{current.prompt}</h2>
          {current.options.length ? (
            <div className="choices">
              {current.options.map((o) => (
                <label key={o}>
                  <input
                    type="radio"
                    name="answer"
                    checked={session.response === o}
                    onChange={() => setSession({ ...session, response: o })}
                  />
                  {o}
                </label>
              ))}
            </div>
          ) : (
            <Field label="Your answer">
              <textarea
                value={session.response}
                onChange={(e) =>
                  setSession({ ...session, response: e.target.value })
                }
              />
            </Field>
          )}
          <div className="actions">
            <Button onClick={() => run(() => advance())}>
              {session.index === session.cards.length - 1
                ? "Finish session"
                : "Save & continue"}
              <ArrowRight size={17} />
            </Button>
            <button
              onClick={() => {
                if (
                  confirm(
                    "End this session? Incomplete results will not be saved.",
                  )
                )
                  setSession(null);
              }}
            >
              End session
            </button>
          </div>
          {moving && (
            <p className="small muted">
              The clock keeps running when you switch tabs or reload.
            </p>
          )}
        </section>
      )}
    </>
  );
}

function Preferences({ data, run, notify }) {
  const [profile, setProfile] = useState({ ...data.profile }),
    [pending, setPending] = useState(null),
    [token, setToken] = useState(""),
    [ai, setAi] = useState(null);
  return (
    <>
      <section className="panel">
        <h2>A space with your name on it</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const row = schemas.settings.parse({
                ...profile,
                dailyTarget: +profile.dailyTarget,
                updatedAt: Date.now(),
              });
              await db.settings.put(row);
              notify("Personalization saved.");
            });
          }}
        >
          <div className="form-grid">
            <Field label="Preferred name">
              <input
                value={profile.name}
                required
                maxLength={80}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </Field>
            <Field label="Daily question target">
              <input
                type="number"
                min="1"
                max="100"
                value={profile.dailyTarget}
                onChange={(e) =>
                  setProfile({ ...profile, dailyTarget: e.target.value })
                }
              />
            </Field>
            <Field label="A little encouragement">
              <input
                value={profile.goal}
                maxLength={200}
                onChange={(e) =>
                  setProfile({ ...profile, goal: e.target.value })
                }
              />
            </Field>
            <Field label="Exam date (optional)">
              <input
                type="date"
                value={profile.examDate}
                onChange={(e) =>
                  setProfile({ ...profile, examDate: e.target.value })
                }
              />
            </Field>
          </div>
          <Button type="submit">Save personalization</Button>
        </form>
      </section>
      <section className="panel">
        <h2>Your library, safely in your hands</h2>
        <p>
          Export a backup to move between phone and laptop. Includes original
          PDFs, extracted pages, study items, personalization, and progress.
        </p>
        <p className="warning">
          Browser storage can be cleared or evicted. Keep regular backups.
          Backups are unencrypted files; store them privately.
        </p>
        <div className="actions">
          <Button
            onClick={() =>
              run(async () =>
                download(
                  await exportBackup(),
                  `medimate-${new Date().toISOString().slice(0, 10)}.json`,
                ),
              )
            }
          >
            <Download size={17} />
            Export backup
          </Button>
          <label className="file-button button">
            <Upload size={17} />
            Import backup
            <input
              aria-label="Import backup"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files[0];
                e.target.value = "";
                if (file)
                  run(async () => {
                    if (
                      file.size > 150 * 1024 * 1024 &&
                      !confirm(
                        "This large backup may use substantial memory. Import it on a laptop if possible. Continue?",
                      )
                    )
                      return;
                    setPending(
                      await inspectImport(JSON.parse(await file.text())),
                    );
                  });
              }}
            />
          </label>
          <button
            onClick={() =>
              run(async () =>
                notify(
                  (await navigator.storage?.persist())
                    ? "Persistent storage enabled. Still keep backups."
                    : "Your browser did not grant persistent storage. Export regular backups.",
                ),
              )
            }
          >
            Request persistent storage
          </button>
        </div>
        {pending && (
          <div className="import-review">
            <h3>Review this import</h3>
            <p>
              {pending.backup.tables.cards.length} study items ·{" "}
              {pending.backup.tables.documents.length} transes ·{" "}
              {pending.conflicts.length} conflicts
            </p>
            {pending.conflicts.length > 0 && (
              <>
                <p>
                  Merge keeps existing local items when IDs conflict. Changed
                  source pages require a full replacement.
                </p>
                <ul>
                  {pending.conflicts.slice(0, 8).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="actions">
              <button
                onClick={() =>
                  run(async () => {
                    await importBackup(pending.backup);
                    setPending(null);
                    notify(
                      "Backup merged. Existing local conflicts were kept.",
                    );
                  })
                }
              >
                Merge, keep local conflicts
              </button>
              <button
                onClick={() =>
                  run(async () => {
                    if (
                      !confirm(
                        "Replace ALL current data with this backup? Export your current library first.",
                      )
                    )
                      return;
                    await importBackup(pending.backup, "replace");
                    sessionStorage.removeItem("medimate-moving");
                    sessionStorage.removeItem("medimate-quiz");
                    location.reload();
                  })
                }
              >
                Replace entire library
              </button>
              <button onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>Optional AI mode</h2>
          <span className="badge">
            {ai?.enabled ? "Configured" : "Disabled by default"}
          </span>
        </div>
        <p>
          Local study is free. AI generation requires a separately configured
          private backend. No provider keys belong in this app.
        </p>
        <p>
          The server enforces a maximum ₱500 monthly allowance using
          conservative reservations. No text is sent by this settings check.
        </p>
        <Field label="Private backend access token (session only; not an AI provider key)">
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Only after configuring the backend"
          />
        </Field>
        <button
          disabled={!token}
          onClick={() =>
            run(async () => {
              const r = await fetch("/api/ai/status", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!r.ok)
                throw Error(
                  "AI backend unavailable or access denied. Local mode remains available.",
                );
              const s = await r.json();
              setAi(s);
              notify(
                s.enabled
                  ? `AI configured. ₱${s.remainingPhp} allowance remains.`
                  : "Backend is connected, but no paid provider adapter is enabled.",
              );
            })
          }
        >
          Check backend connection
        </button>
        {ai && (
          <p>
            Monthly ceiling: ₱{ai.limitPhp} · Reserved: ₱{ai.usedPhp} ·
            Remaining: ₱{ai.remainingPhp}
          </p>
        )}
        <p className="small muted">
          This MVP includes the secured backend contract and budget guard. A
          paid provider adapter and generation UI are intentionally not
          activated.
        </p>
      </section>
      <section className="panel">
        <h2>Privacy & offline use</h2>
        <p>
          No analytics, account, or cloud sync. Study data stays in this browser
          profile. Devices do not sync automatically; use backups to transfer
          your library. Device users with access to this browser can access the
          data.
        </p>
        <p>
          Offline support is available after the production app finishes
          caching. Install through your browser’s app menu where supported. Keep
          the same address and port to retain access to this library.
        </p>
      </section>
    </>
  );
}
