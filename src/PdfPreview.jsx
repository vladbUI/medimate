import React,{useEffect,useRef,useState} from 'react';
import {getDocument} from 'pdfjs-dist';
export default function PdfPreview({url,page}){
 const canvas=useRef(null);const [status,setStatus]=useState('Loading source page…');
 useEffect(()=>{
  let cancelled=false,render;
  setStatus('Loading source page…');
  const task=getDocument({url,isEvalSupported:false,cMapUrl:'/cmaps/',cMapPacked:true,standardFontDataUrl:'/standard_fonts/',wasmUrl:'/wasm/'});
  (async()=>{try{const pdf=await task.promise;if(cancelled)return;const sheet=await pdf.getPage(Number(page));if(cancelled)return;const viewport=sheet.getViewport({scale:1.5});const el=canvas.current;el.width=viewport.width;el.height=viewport.height;render=sheet.render({canvasContext:el.getContext('2d'),viewport});await render.promise;if(!cancelled)setStatus('');}catch{if(!cancelled)setStatus('Preview unavailable. Open the original PDF using the link above.');}})();
  return()=>{cancelled=true;render?.cancel();void task.destroy();};
 },[url,page]);
 return <div className="source-preview">{status&&<p role="status">{status}</p>}<canvas ref={canvas} hidden={!!status} aria-label={`Original PDF page ${page}`}/></div>;
}
