import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { db, uid } from "./db";
pdfjs.GlobalWorkerOptions.workerSrc = worker;
const options = {
  isEvalSupported: false,
  cMapUrl: "/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/standard_fonts/",
  wasmUrl: "/wasm/",
};
export async function addPDF(file, subjectId) {
  if (file.size > 50 * 1024 * 1024)
    throw Error("Choose a PDF under 50 MB. Split larger transes into volumes.");
  const buffer = await file.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const duplicate = await db.documents
    .filter((d) => d.hash === hash && d.subjectId === subjectId)
    .first();
  if (duplicate) return duplicate.id;
  const task = pdfjs.getDocument({ ...options, data: new Uint8Array(buffer) });
  let pdf;
  try {
    pdf = await task.promise;
    if (pdf.numPages > 3000)
      throw Error("Split this PDF into volumes of at most 3,000 pages.");
    const id = uid();
    await db.transaction("rw", db.documents, db.files, async () => {
      await db.documents.add({
        id,
        name: file.name,
        subjectId,
        total: pdf.numPages,
        hash,
        updatedAt: Date.now(),
      });
      await db.files.add({
        id,
        blob: new Blob([file], { type: "application/pdf" }),
      });
    });
    return id;
  } finally {
    await task.destroy();
  }
}
export async function extractPDF(
  documentId,
  { shouldStop = () => false, onProgress = () => {}, retry = false } = {},
) {
  const file = await db.files.get(documentId);
  const original = await db.documents.get(documentId);
  if (!file || !original)
    throw Error("Original PDF is missing. Import a backup containing the PDF.");
  const task = pdfjs.getDocument({
    ...options,
    data: new Uint8Array(await file.blob.arrayBuffer()),
  });
  try {
    const pdf = await task.promise;
    for (let number = 1; number <= pdf.numPages; number++) {
      if (shouldStop()) break;
      const id = `${documentId}:${number}`;
      const old = await db.pages.get(id);
      if (old && (!retry || old.status === "extracted")) continue;
      let page;
      let record = {
        id,
        documentId,
        number,
        text: "",
        status: "failed",
        error: "",
        reviewed: false,
        updatedAt: Date.now(),
      };
      try {
        page = await pdf.getPage(number);
        const content = await page.getTextContent();
        record.text = content.items
          .map((i) => i.str + (i.hasEOL ? "\n" : " "))
          .join("")
          .trim();
        record.status = record.text.length ? "extracted" : "needs-review";
        if (!record.text)
          record.error =
            "No text layer detected. This page may be blank or image-only; review the original. OCR is not included.";
      } catch (e) {
        record.error = String(e.message || e).slice(0, 1000);
      } finally {
        page?.cleanup();
      }
      if (shouldStop()) break;
      const saved = await db.transaction(
        "rw",
        db.documents,
        db.pages,
        async () => {
          const current = await db.documents.get(documentId);
          if (
            !current ||
            current.hash !== original.hash ||
            current.updatedAt !== original.updatedAt
          )
            return false;
          await db.pages.put(record);
          return true;
        },
      );
      if (!saved) break;
      onProgress(number);
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    await task.destroy();
  }
}
