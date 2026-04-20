import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, FileText, Loader2 } from "lucide-react";

interface EmbeddedReportViewerProps {
  fileUrl: string;
  fileName: string;
  fileType?: string;
  onClose: () => void;
}

export default function EmbeddedReportViewer({ fileUrl, fileName, fileType, onClose }: EmbeddedReportViewerProps) {
  const isImage = fileType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
  const isPdf = fileType === "application/pdf" || /\.pdf$/i.test(fileName);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let revokedUrl: string | null = null;
    const fetchAsBlob = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const typedBlob = isPdf
          ? new Blob([blob], { type: "application/pdf" })
          : blob;
        const url = URL.createObjectURL(typedBlob);
        revokedUrl = url;
        setBlobUrl(url);
      } catch (e) {
        console.error("Failed to load report:", e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAsBlob();
    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [fileUrl, isPdf]);

  return (
    <div className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="font-semibold truncate text-sm">{fileName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Watermark overlay */}
      <div className="relative flex-1 overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-10">
          <p className="text-6xl font-bold text-foreground rotate-[-30deg] whitespace-nowrap">
            TurantCare — Confidential
          </p>
        </div>

        {/* Content */}
        <div className="h-full w-full overflow-auto flex items-center justify-center p-4">
          {isPdf ? (
            <iframe
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full rounded-lg border border-border"
              style={{ minHeight: "80vh" }}
              title={fileName}
            />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain rounded-lg"
              draggable={false}
            />
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Preview not available for this file type.</p>
              <p className="text-xs text-muted-foreground mt-2">{fileName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Anti-print/download CSS */}
      <style>{`
        @media print { body { display: none !important; } }
      `}</style>
    </div>
  );
}
