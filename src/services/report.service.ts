import { supabase } from "@/integrations/supabase/client";

export async function getPatientReports(patientId: string, showPrivate: boolean) {
  let query = supabase
    .from("report_files")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (!showPrivate) {
    query = query.eq("is_private", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function logReportAccess(patientId: string, accessedByRole: string, accessedById: string) {
  await supabase.from("access_logs").insert({
    patient_id: patientId,
    accessed_by_role: accessedByRole,
    accessed_by_id: accessedById,
    action: "view",
  });
}

export async function getExistingSummary(patientId: string, dateGroup: string) {
  const { data } = await supabase
    .from("ai_summaries")
    .select("*")
    .eq("patient_id", patientId)
    .eq("date_group", dateGroup)
    .maybeSingle();

  return data;
}

export async function generateAISummary(patientId: string, dateGroup: string, reportNames: string[]) {
  const { data, error } = await supabase.functions.invoke("ai-summary", {
    body: { patientId, dateGroup, reportNames },
  });

  if (error) throw error;
  return data;
}

export async function storeAISummary(patientId: string, dateGroup: string, summaryText: string) {
  await supabase.from("ai_summaries").upsert(
    {
      patient_id: patientId,
      date_group: dateGroup,
      summary_text: summaryText,
    },
    { onConflict: "patient_id,date_group" }
  );
}
