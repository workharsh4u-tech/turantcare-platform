import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Folder, FileText, ArrowLeft, Bot, X, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import TrendGraph from "@/components/TrendGraph";

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
  
  const { user } = useAuth();

  useEffect(() => {
    loadReports();
  }, [patientId]);

  const loadReports = async () => {
    let query = supabase
      .from("report_files")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (!showPrivate) {
      query = query.eq("is_private", false);
    }

    const { data } = await query;
    if (data) {
      setReports(data);
      const groups = [...new Set(data.map((r: any) => r.date_group))].sort().reverse();
      setDateGroups(groups);
    }

    // Log access
    if (user) {
      await supabase.from("access_logs").insert({
        patient_id: patientId,
        accessed_by_role: accessedByRole,
        accessed_by_id: user.id,
        action: "view",
      });
    }
  };

  const loadSummary = async (dateGroup: string) => {
    setLoadingSummary(true);
    setSummary(null);

    // Check existing summary
    const { data: existing } = await supabase
      .from("ai_summaries")
      .select("*")
      .eq("patient_id", patientId)
      .eq("date_group", dateGroup)
      .single();

    if (existing) {
      setSummary(existing.summary_text);
      setLoadingSummary(false);
      return;
    }

    // Generate new summary via AI
    try {
      const dateReports = reports.filter((r) => r.date_group === dateGroup);
      const { data, error } = await supabase.functions.invoke("ai-summary", {
        body: { patientId, dateGroup, reportNames: dateReports.map((r: any) => r.file_name) },
      });
      if (data?.summary) {
        setSummary(data.summary);
        // Store summary (include parameters JSON for trend tracking)
        const summaryToStore = data.parameters?.length
          ? `${data.summary}\n\n\`\`\`json\n${JSON.stringify({ parameters: data.parameters })}\n\`\`\``
          : data.summary;
        await supabase.from("ai_summaries").upsert({
          patient_id: patientId,
          date_group: dateGroup,
          summary_text: summaryToStore,
        }, { onConflict: "patient_id,date_group" });
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
                        title="Open report in new tab"
                        onClick={async () => {
                          try {
                            const res = await fetch(r.file_url);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const win = window.open(url, "_blank", "noopener,noreferrer");
                            if (!win) {
                              // Popup blocked — fallback to direct navigation
                              window.location.href = url;
                            }
                            setTimeout(() => URL.revokeObjectURL(url), 60000);
                          } catch (e) {
                            console.error("Failed to open report:", e);
                            window.open(r.file_url, "_blank", "noopener,noreferrer");
                          }
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="bg-accent/30 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
                    <Bot className="w-4 h-4" /> AI Summary
                  </h4>
                  {loadingSummary ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-4 bg-muted rounded w-2/3" />
                    </div>
                  ) : summary ? (
                    <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{summary}</ReactMarkdown>
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

    </>
  );
}
