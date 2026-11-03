import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import api from '../lib/api.js';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function PdfDocumentPreview({ jobId, kind, label }) {
  const canvasRefs = useRef([]);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let loadingTask;

    async function loadPdf() {
      setLoading(true);
      setError('');
      setPdfDocument(null);
      try {
        const { data } = await api.get(`/translations/jobs/${encodeURIComponent(jobId)}/${kind}`, {
          params: { inline: 1 },
          responseType: 'arraybuffer',
          timeout: 120000,
        });
        if (!active) return;
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
        const pdf = await loadingTask.promise;
        if (active) setPdfDocument(pdf);
      } catch (renderError) {
        if (active) setError(renderError.message || 'This PDF could not be displayed.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPdf();
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [jobId, kind]);

  useEffect(() => {
    if (!pdfDocument) return undefined;
    let active = true;
    const renderTasks = [];

    async function renderPages() {
      try {
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          if (!active) return;
          const canvas = canvasRefs.current[pageNumber - 1];
          if (!canvas) throw new Error(`Could not prepare page ${pageNumber} for display.`);
          const page = await pdfDocument.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const scale = Math.max(0.5, (canvas.parentElement.clientWidth / baseViewport.width) * pixelRatio);
          const viewport = page.getViewport({ scale });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error(`Could not prepare page ${pageNumber} for display.`);
          const renderTask = page.render({ canvas, canvasContext: context, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
        }
      } catch (renderError) {
        if (active && renderError.name !== 'RenderingCancelledException') {
          setError(renderError.message || 'This PDF page could not be displayed.');
        }
      }
    }

    void renderPages();
    return () => {
      active = false;
      renderTasks.forEach((task) => task.cancel());
    };
  }, [pdfDocument]);

  return (
    <div className="pdf-document-viewer" aria-label={label}>
      {loading && <p className="pdf-preview-status">Loading PDF pages…</p>}
      {error && <p className="pdf-preview-status pdf-preview-error">{error}</p>}
      {pdfDocument && Array.from({ length: pdfDocument.numPages }, (_, index) => (
        <div className="pdf-document-page" key={index}>
          <canvas
            ref={(canvas) => { canvasRefs.current[index] = canvas; }}
            role="img"
            aria-label={`${label}, page ${index + 1} of ${pdfDocument.numPages}`}
          />
          <span>Page {index + 1} of {pdfDocument.numPages}</span>
        </div>
      ))}
    </div>
  );
}
