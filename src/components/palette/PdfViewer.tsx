import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AlertCircle, Loader2, Minus, Plus } from "lucide-react";
import { isTauri } from "@/lib/tauri";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 60;
const MAX_BYTES = 64 * 1024 * 1024;

interface PdfViewerProps {
  src?: string;
  path?: string;
}

export function PdfViewer({ src, path }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState(1.25);
  const [pages, setPages] = useState<number[]>([]);
  const [rendered, setRendered] = useState(0);
  const [gettingDocument, setGettingDocument] = useState(true);

  useEffect(() => {
    let active = true;
    setGettingDocument(true);
    setError(false);
    setDoc(null);
    setPages([]);
    setRendered(0);

    async function load() {
      try {
        let data: Uint8Array;
        if (isTauri() && path) {
          const b64 = await invoke<string | null>("read_file_base64", { path, maxBytes: MAX_BYTES });
          if (b64 === null) throw new Error("too-large");
          const bin = atob(b64);
          data = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
        } else if (src) {
          const res = await fetch(src);
          if (!res.ok) throw new Error("fetch-failed");
          data = new Uint8Array(await res.arrayBuffer());
        } else {
          throw new Error("no-source");
        }
        const loaded = await pdfjs.getDocument({ data }).promise;
        if (!active) return;
        setDoc(loaded);
        setPages(Array.from({ length: Math.min(loaded.numPages, MAX_PAGES) }, (_, i) => i + 1));
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setGettingDocument(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [src, path]);

  useEffect(() => {
    if (!doc || pages.length === 0) return;
    const current = doc;
    const dpr = window.devicePixelRatio || 1;
    let cancelled = false;

    async function renderAll() {
      for (const num of pages) {
        if (cancelled) return;
        const canvas = canvasRefs.current[num];
        if (!canvas) return;
        const page = await current.getPage(num);
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        await page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        }).promise;
        setRendered(num);
      }
    }
    void renderAll();
    return () => {
      cancelled = true;
    };
  }, [doc, pages, scale]);

  if (gettingDocument) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading PDF…
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <p>Couldn't open this PDF.</p>
      </div>
    );
  }

  const zoomIn = () => setScale((s) => Math.min(4, s * 1.2));
  const zoomOut = () => setScale((s) => Math.max(0.5, s / 1.2));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        <span className="flex-1 text-[11px] text-muted-foreground">
          {pages.length} page{pages.length === 1 ? "" : "s"}
          {doc.numPages > MAX_PAGES ? ` · first ${MAX_PAGES} shown` : ""}
          {rendered > 0 && rendered < pages.length ? ` · rendering ${rendered}/${pages.length}` : ""}
        </span>
        <button
          type="button"
          onClick={zoomOut}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-10 text-center text-[11px] tabular-nums text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4">
        <div className="mx-auto flex w-max flex-col gap-4">
          {pages.map((num) => (
            <canvas
              key={num}
              ref={(el) => {
                canvasRefs.current[num] = el;
              }}
              className="rounded-sm bg-white shadow-lg"
            />
          ))}
        </div>
      </div>
    </div>
  );
}