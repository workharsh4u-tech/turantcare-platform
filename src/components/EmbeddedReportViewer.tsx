import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

interface EmbeddedReportViewerProps {
  fileUrl: string;
  fileName: string;
  fileType?: string;
  watermark?: string;
  onClose: () => void;
}

export default function EmbeddedReportViewer({
  fileUrl,
  fileName,
  fileType,
  watermark,
  onClose,
}: EmbeddedReportViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detect file type
  const lowerName = fileName.toLowerCase();
  const isPdf = (fileType?.includes("pdf")) || lowerName.endsWith(".pdf");
  const isImage =
    (fileType?.startsWith("image/")) ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revoked = url;
        if (!cancelled) {
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load report");
          setLoading(false);
        }
      }
    })();

    // Block printing while viewer is open
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-embedded-report-viewer", "true");
    styleEl.textContent = `@media print { body { display: none !important; } }`;
    document.head.appendChild(styleEl);

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
      styleEl.remove();
    };
  }, [fileUrl]);

  return (
    <div className="fixed inset-0 z-[60] bg-background/90 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-elevated max-w-6xl w-full h-[92vh] border border-border flex flex-col overflow-hidden relative">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm truncate">{fileName}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 relative bg-muted/40 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading report…
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-destructive text-sm">
              {error}
            </div>
          )}

          {!loading && !error && blobUrl && isPdf && (
            <iframe
              src={blobUrl}
              title={fileName}
              className="w-full h-full border-0"
            />
          )}

          {!loading && !error && blobUrl && isImage && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
            </div>
          )}

          {!loading && !error && blobUrl && !isPdf && !isImage && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
              Preview not supported for this file type. Please contact the patient for an alternative format.
            </div>
          )}

          {/* Watermark overlay */}
          {watermark && !loading && !error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
              <span className="text-4xl font-bold text-foreground/10 rotate-[-30deg] whitespace-pre-line text-center">
                {watermark}
              </span>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
          Confidential medical record. Printing and downloading are restricted.
        </div>
      </div>
    </div>
  );
}
