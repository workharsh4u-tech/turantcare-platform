import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { setPin } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import ReportViewer from "@/components/ReportViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  FileText, User, Shield, Clock, QrCode, Bot,
  CreditCard, Lock, Eye, Folder, MessageSquare
} from "lucide-react";

export default function PatientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"profile" | "reports" | "logs" | "vault" | "chat">("profile");
  const [patient, setPatient] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [newPin, setNewPin] = useState("");
  const [showReports, setShowReports] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [vaultShared, setVaultShared] = useState(false);
  const [vaultTimer, setVaultTimer] = useState(0);
  const [vaultTimerId, setVaultTimerId] = useState<ReturnType<typeof setInterval> | null>(null);
  const [sharedReportIds, setSharedReportIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const { data: p } = await supabase.from("patients").select("*").eq("user_id", user!.id).single();
    if (p) {
      setPatient(p);
      setForm(p);
      const { data: r } = await supabase.from("report_files").select("*").eq("patient_id", p.id).order("created_at", { ascending: false });
      setReports(r || []);
      const { data: l } = await supabase.from("access_logs").select("*").eq("patient_id", p.id).order("created_at", { ascending: false }).limit(50);
      setLogs(l || []);
    }
  };

  const handleSetPin = async () => {
    if (newPin.length < 4) { toast({ title: "PIN must be at least 4 digits", variant: "destructive" }); return; }
    const { error } = await setPin(newPin);
    if (error) toast({ title: "Error setting PIN", variant: "destructive" });
    else { toast({ title: "PIN set successfully!" }); setNewPin(""); }
  };

  const handleSaveProfile = async () => {
    const { error } = await supabase.from("patients").update({
      name: form.name, age: form.age ? parseInt(form.age) : null, gender: form.gender,
      blood_group: form.blood_group, diabetes: form.diabetes,
      allergies: form.allergies, chronic_conditions: form.chronic_conditions,
      emergency_contact: form.emergency_contact,
    }).eq("id", patient.id);
    if (error) toast({ title: "Error saving", variant: "destructive" });
    else { toast({ title: "Profile saved!" }); setEditing(false); loadData(); }
  };

  // Cleanup vault timer on unmount
  useEffect(() => {
    return () => { if (vaultTimerId) clearInterval(vaultTimerId); };
  }, [vaultTimerId]);

  const startVaultShare = async () => {
    const duration = 15 * 60;
    const privateReports = reports.filter((r) => r.is_private);
    const ids = privateReports.map((r) => r.id);
    setSharedReportIds(ids);
    setVaultShared(true);
    setVaultTimer(duration);

    // Make all private reports temporarily visible
    for (const rid of ids) {
      await supabase.from("report_files").update({ is_private: false }).eq("id", rid);
    }
    loadData();
    toast({ title: "Vault shared for 15 minutes", description: "Private reports are now temporarily visible." });

    const id = setInterval(() => {
      setVaultTimer((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          lockVaultWithIds(ids);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setVaultTimerId(id);
  };

  const lockVaultWithIds = async (ids: string[]) => {
    setVaultShared(false);
    setVaultTimer(0);
    setVaultTimerId((prev) => { if (prev) clearInterval(prev); return null; });
    // Re-lock all previously private reports
    for (const rid of ids) {
      await supabase.from("report_files").update({ is_private: true }).eq("id", rid);
    }
    setSharedReportIds([]);
    toast({ title: "Vault locked", description: "Private reports are hidden again." });
    loadData();
  };

  const lockVault = () => lockVaultWithIds(sharedReportIds);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePrivate = async (reportId: string, isPrivate: boolean) => {
    await supabase.from("report_files").update({ is_private: isPrivate }).eq("id", reportId);
    loadData();
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const newMsg = { role: "user", content: chatInput };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("patient-chat", {
        body: { messages: [...chatMessages, newMsg], patientId: patient?.id },
      });
      if (data?.reply) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Try again." }]);
    }
    setChatLoading(false);
  };

  const navItems = [
    { label: "Profile", icon: <User className="w-4 h-4" />, active: tab === "profile", onClick: () => setTab("profile") },
    { label: "Reports", icon: <FileText className="w-4 h-4" />, active: tab === "reports", onClick: () => setTab("reports") },
    { label: "Access Logs", icon: <Clock className="w-4 h-4" />, active: tab === "logs", onClick: () => setTab("logs") },
    { label: "Privacy Vault", icon: <Shield className="w-4 h-4" />, active: tab === "vault", onClick: () => setTab("vault") },
    { label: "AI Chat", icon: <Bot className="w-4 h-4" />, active: tab === "chat", onClick: () => setTab("chat") },
  ];

  const dateGroups = [...new Set(reports.map((r) => r.date_group))].sort().reverse();

  if (!patient) return <DashboardLayout title="Loading..."><div /></DashboardLayout>;

  return (
    <DashboardLayout title="Patient Dashboard" subtitle={`Welcome, ${patient.name || "Patient"}`} nav={navItems}>
      {/* Profile Tab */}
      {tab === "profile" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Your TurantCare Card
            </h3>
            <div className="p-6 rounded-xl gradient-primary text-primary-foreground">
              <div className="flex items-center justify-between mb-6">
                <FileText className="w-8 h-8" />
                <span className="text-sm opacity-80">TurantCare</span>
              </div>
              <p className="text-2xl font-mono tracking-wider mb-4">{patient.card_number}</p>
              <p className="text-sm opacity-80">{patient.name}</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Show this QR to your doctor or diagnostic center</span>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Profile
              </h3>
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </Button>
            </div>
            <div className="grid gap-3">
              {[
                { label: "Name", key: "name" },
                { label: "Age", key: "age", type: "number" },
                { label: "Gender", key: "gender" },
                { label: "Blood Group", key: "blood_group" },
                { label: "Allergies", key: "allergies" },
                { label: "Chronic Conditions", key: "chronic_conditions" },
                { label: "Emergency Contact", key: "emergency_contact" },
              ].map((field) => (
                <div key={field.key}>
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  {editing ? (
                    <Input
                      value={form[field.key] || ""}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      type={field.type || "text"}
                    />
                  ) : (
                    <p className="text-sm font-medium">{patient[field.key] || "—"}</p>
                  )}
                </div>
              ))}
              <div>
                <Label className="text-xs text-muted-foreground">Diabetes</Label>
                {editing ? (
                  <Switch checked={form.diabetes} onCheckedChange={(v) => setForm({ ...form, diabetes: v })} />
                ) : (
                  <p className="text-sm font-medium">{patient.diabetes ? "Yes" : "No"}</p>
                )}
              </div>
              {editing && <Button onClick={handleSaveProfile} className="mt-2">Save Profile</Button>}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Set/Change PIN
            </h3>
            <p className="text-sm text-muted-foreground mb-3">Your PIN protects your reports. Share it only with your doctor.</p>
            <div className="flex gap-2">
              <Input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="4-6 digit PIN" maxLength={6} />
              <Button onClick={handleSetPin}>Set PIN</Button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {tab === "reports" && (
        <div className="space-y-3">
          {dateGroups.length === 0 && <p className="text-muted-foreground text-center py-12">No reports yet.</p>}
          {dateGroups.map((d) => {
            const group = reports.filter((r) => r.date_group === d && !r.is_private);
            return (
              <div key={d} className="bg-card rounded-xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold">{d}</p>
                    <p className="text-sm text-muted-foreground">{group.length} file(s)</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 pl-8">
                  {group.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1">{r.file_name}</span>
                      <a href={r.file_url} target="_blank" rel="noopener"><Button variant="ghost" size="sm"><Eye className="w-3 h-3" /></Button></a>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Access Logs Tab */}
      {tab === "logs" && (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Who</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Action</th>
                  <th className="text-left p-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No access logs.</td></tr>}
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="p-3">{l.accessed_by_name || l.accessed_by_id.slice(0, 8)}</td>
                    <td className="p-3 capitalize">{l.accessed_by_role}</td>
                    <td className="p-3 capitalize">{l.action}</td>
                    <td className="p-3 text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Privacy Vault */}
      {tab === "vault" && (
        <div className="space-y-4">
          <div className="bg-accent/30 rounded-lg p-4 text-sm">
            <p className="font-medium flex items-center gap-2"><Shield className="w-4 h-4" /> Privacy Vault</p>
            <p className="text-muted-foreground mt-1">Reports in your vault are hidden from doctors and diagnostic centers, even with your PIN.</p>
          </div>

          {/* Timed Share Toggle */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Temporary Vault Share
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {vaultShared
                    ? `Vault is open — auto-locks in ${formatTimer(vaultTimer)}`
                    : "Share all private reports for 15 minutes, then auto-lock"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {vaultShared && (
                  <Button variant="destructive" size="sm" onClick={lockVault}>
                    <Lock className="w-3 h-3 mr-1" /> Lock Now
                  </Button>
                )}
                <Switch
                  checked={vaultShared}
                  onCheckedChange={(v) => { if (v) startVaultShare(); else lockVault(); }}
                />
              </div>
            </div>
            {vaultShared && (
              <div className="mt-3">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(vaultTimer / (15 * 60)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Report list */}
          {reports.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{r.file_name}</p>
                <p className="text-xs text-muted-foreground">{r.date_group}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{r.is_private ? "Private" : "Visible"}</span>
                <Switch
                  checked={r.is_private}
                  onCheckedChange={(v) => togglePrivate(r.id, v)}
                  disabled={vaultShared}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Chat */}
      {tab === "chat" && (
        <div className="bg-card rounded-xl border border-border shadow-card max-w-2xl">
          <div className="p-4 border-b border-border">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" /> AI Health Assistant
            </h3>
            <p className="text-xs text-muted-foreground mt-1">⚠️ This is not medical advice. Always consult your doctor.</p>
          </div>
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <p className="text-muted-foreground text-center text-sm py-12">Ask me about your reports in simple language!</p>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && <div className="flex justify-start"><div className="bg-muted p-3 rounded-lg text-sm animate-pulse">Thinking...</div></div>}
          </div>
          <div className="p-4 border-t border-border flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about your reports..." onKeyDown={(e) => e.key === "Enter" && sendChat()} />
            <Button onClick={sendChat} disabled={chatLoading}>Send</Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
