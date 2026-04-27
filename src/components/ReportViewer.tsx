import { useState, useEffect } from "react";
import {
  getPatientReports,
  logReportAccess,
  getExistingSummary,
  generateAISummary,
  storeAISummary
} from "@/services/report.service";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Folder, FileText, ArrowLeft, Bot, X, Eye, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TrendGraph from "@/components/TrendGraph";
import EmbeddedReportViewer from "@/components/EmbeddedReportViewer";

interface ReportViewerProps {
  patientId: string;
  accessedByRole: string;
  onClose: () => void;
  showPrivate?: boolean;
}

export default function ReportViewer({ patientId, accessedByRole, onClose, showPrivate = false }: ReportViewerProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [dateGroups, setDateGroups] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [viewerFile, setViewerFile] = useState<any | null>(null);

  const { user, profile } = useAuth();

  useEffect(() => {
    loadReports();
  }, [patientId]);

  const loadReports = async () => {
  try {
    const data = await getPatientReports(patientId, showPrivate);
    setReports(data);

    const groups = [...new Set(data.map((r: any) => r.date_group))].sort().reverse();
    setDateGroups(groups);

    if (user) {
      await logReportAccess(patientId, accessedByRole, user.id);
    }
  } catch (err) {
    console.error("Report loading failed:", err);
  }
};

  const loadSummary = async (dateGroup: string, forceRegenerate = false) => {
    setLoadingSummary(true);
    setSummary(null);

    if (!forceRegenerate) {
      // Check existing summary
      const existing = await getExistingSummary(patientId, dateGroup);

      if (existing) {
        setSummary(existing.summary_text);
        setLoadingSummary(false);
        return;
      }
    }

    // Generate new summary via AI
    try {
      const dateReports = reports.filter((r) => r.date_group === dateGroup);
      const data = await generateAISummary(
      patientId,
      dateGroup,
      dateReports.map((r: any) => r.file_name)
    );
      if (data?.summary) {
        setSummary(data.summary);
        // Store summary (include parameters JSON for trend tracking)
        const summaryToStore = data.parameters?.length
          ? `${data.summary}\n\n\`\`\`json\n${JSON.stringify({ parameters: data.parameters })}\n\`\`\``
          : data.summary;
        await storeAISummary(patientId, dateGroup, summaryToStore);
      }
    } catch {
      setSummary("AI summary unavailable at this time.");
    }
    setLoadingSummary(false);
  };

  const dateReports = selectedDate ? reports.filter((r) => r.date_group === selectedDate) : [];
  const isDoctorView = accessedByRole === "doctor";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-elevated max-w-5xl w-full max-h-[90vh] overflow-hidden border border-border flex flex-col">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedDate && (
                <Button variant="ghost" size="icon" onClick={() => { setSelectedDate(null); setSummary(null); }}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <h3 className="font-display text-xl font-bold">
                {selectedDate ? `Reports — ${selectedDate}` : "Medical Reports"}
              </h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!selectedDate ? (
              <div className="space-y-6">
                {/* Trend Graph - Doctor view only */}
                {isDoctorView && (
                  <TrendGraph patientId={patientId} />
                )}

                <div className="grid gap-3">
                  {dateGroups.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">No reports found.</p>
                  )}
                  {dateGroups.map((d) => {
                    const count = reports.filter((r) => r.date_group === d).length;
                    const types = [...new Set(reports.filter((r) => r.date_group === d).map((r: any) => r.report_type).filter(Boolean))];
                    return (
                      <button
                        key={d}
                        onClick={() => { setSelectedDate(d); loadSummary(d); }}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/30 transition-all text-left"
                      >
                        <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                          <Folder className="w-6 h-6 text-accent-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{d}</p>
                          <p className="text-sm text-muted-foreground">
                            {count} file(s) {types.length > 0 && `• ${types.join(", ")}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Files</h4>
                  {dateReports.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{r.file_name}</p>
                        <p className="text-xs text-muted-foreground">{r.report_type || r.file_type} • {r.uploaded_by_role}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Open report in viewer"
                        onClick={() => setViewerFile(r)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="bg-accent/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Bot className="w-4 h-4" /> AI Summary
                    </h4>
                    {selectedDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loadingSummary}
                        onClick={() => loadSummary(selectedDate, true)}
                        title="Regenerate AI summary"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? "animate-spin" : ""}`} />
                        <span className="ml-1.5 text-xs">Regenerate</span>
                      </Button>
                    )}
                  </div>
                  {loadingSummary ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-4 bg-muted rounded w-2/3" />
                    </div>
                  ) : summary ? (
                    <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-table:text-xs prose-th:px-2 prose-td:px-2 prose-th:py-1 prose-td:py-1 prose-table:border prose-th:border prose-td:border prose-th:border-border prose-td:border-border">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No summary available.</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-4 italic">⚠️ AI-generated summary. Not medical advice.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewerFile && (
        <EmbeddedReportViewer
          fileUrl={viewerFile.file_url}
          fileName={viewerFile.file_name}
          fileType={viewerFile.file_type}
          watermark={`TurantCare\n${profile?.full_name || accessedByRole}\n${new Date().toLocaleString()}`}
          onClose={() => setViewerFile(null)}
        />
      )}
    </>
  );
}
