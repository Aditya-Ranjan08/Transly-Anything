import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import api from '../lib/api.js';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function PdfDocumentPreview({ jobId, kind, label }) {
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let loadingTask;
    const renderTasks = [];

    async function renderPdf() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/translations/jobs/${encodeURIComponent(jobId)}/${kind}`, {
          params: { inline: 1 },
          responseType: 'arraybuffer',
          timeout: 120000,
        });
        if (!active) return;
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
        const pdf = await loadingTask.promise;
        const viewer = viewerRef.current;
        if (!active || !viewer) return;
        viewer.replaceChildren();

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (!active) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const scale = Math.max(0.5, (viewer.clientWidth / baseViewport.width) * pixelRatio);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `${label}, page ${pageNumber} of ${pdf.numPages}`);
          const renderTask = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
          if (active) viewer.append(canvas);
        }
      } catch {
        if (active) setError('This PDF could not be displayed. Use the PDF download button to open it.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void renderPdf();
    return () => {
      active = false;
      renderTasks.forEach((task) => task.cancel());
      if (loadingTask) void loadingTask.destroy();
    };
  }, [jobId, kind, label]);

  return (
    <div className="pdf-document-viewer" ref={viewerRef} aria-label={label}>
      {loading && <p className="pdf-preview-status">Loading PDF pages…</p>}
      {error && <p className="pdf-preview-status pdf-preview-error">{error}</p>}
    </div>
  );
}
