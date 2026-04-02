import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { patientId, dateGroup, reportNames } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a medical report analyzer for doctors. Your task is to extract structured lab values from diagnostic reports.

RULES:
1. Extract key medical parameters with: Parameter Name, Patient Value, Reference Range, Status (HIGH/LOW/NORMAL).
2. Parameters to look for: Hemoglobin, RBC, WBC, Platelets, Cholesterol (Total, LDL, HDL), Glucose (Fasting, PP, Random, HbA1c), Creatinine, BUN, Liver enzymes (ALT/SGPT, AST/SGOT, ALP, Bilirubin), Thyroid (TSH, T3, T4, Free T4), Uric Acid, Calcium, Vitamin D, Vitamin B12, Iron, Ferritin, ESR, CRP, Sodium, Potassium, and any other measurable lab value.
3. Prioritize showing ABNORMAL values first (HIGH or LOW).

OUTPUT FORMAT (use markdown):

## ⚠️ Abnormal Values

| Parameter | Patient Value | Reference Range | Status |
|-----------|--------------|-----------------|--------|
| Hemoglobin | 10 g/dL | 12–18 g/dL | 🔴 LOW |
| Platelets | 120,000 /µL | 150,000–450,000 /µL | 🔴 LOW |
| Glucose (Fasting) | 210 mg/dL | 70–100 mg/dL | 🔴 HIGH |

## ✅ Normal Values

| Parameter | Patient Value | Reference Range | Status |
|-----------|--------------|-----------------|--------|
| WBC | 7,500 /µL | 4,500–11,000 /µL | ✅ Normal |

## Summary

Brief 2-3 sentence clinical interpretation highlighting the most important findings and possible conditions.

ADDITIONAL RULES:
- If no abnormal values, show: "✅ All key parameters are within normal range." and list normal values.
- For radiology/imaging reports (X-ray, MRI, CT, Ultrasound): describe key findings in a structured bullet list instead of a table.
- For clinical/general reports: extract any measurable values or key observations.
- Keep summary concise and data-driven. No long paragraphs.
- Always include units with values.
- IMPORTANT: You must also return a JSON block at the very end of your response wrapped in \`\`\`json ... \`\`\` containing extracted parameters for trend tracking. Format:
\`\`\`json
{"parameters": [{"name": "Hemoglobin", "value": 10, "unit": "g/dL"}, {"name": "Platelets", "value": 120000, "unit": "/µL"}]}
\`\`\`
Only include parameters with numeric values. If no numeric values can be extracted, return {"parameters": []}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Patient visit on ${dateGroup}. Reports uploaded: ${reportNames.join(", ")}. Please analyze these reports and extract structured medical data for the doctor.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ summary: "AI summary temporarily unavailable.", parameters: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const fullText = data.choices?.[0]?.message?.content || "No summary generated.";

    // Extract JSON parameters block from the response
    let parameters: any[] = [];
    const jsonMatch = fullText.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        parameters = parsed.parameters || [];
      } catch { /* ignore parse errors */ }
    }

    // Remove JSON block from displayed summary
    const summary = fullText.replace(/```json[\s\S]*?```/, "").trim();

    return new Response(JSON.stringify({ summary, parameters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ summary: "Error generating summary.", parameters: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
