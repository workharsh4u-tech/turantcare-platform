import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp } from "lucide-react";

const PARAMETER_OPTIONS = [
  "Platelets", "WBC", "RBC", "Hemoglobin", "Glucose", "Cholesterol",
  "Creatinine", "TSH", "T3", "T4", "Free T4", "ALT", "AST", "ALP",
  "Bilirubin", "Uric Acid", "Calcium", "Vitamin D", "Vitamin B12",
  "Iron", "Ferritin", "ESR", "CRP", "Sodium", "Potassium", "HbA1c",
  "LDL", "HDL", "BUN"
];

interface TrendGraphProps {
  patientId: string;
}

export default function TrendGraph({ patientId }: TrendGraphProps) {
  const [selectedParam, setSelectedParam] = useState("Platelets");
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummaries();
  }, [patientId]);

  const loadSummaries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_summaries")
      .select("*")
      .eq("patient_id", patientId)
      .order("date_group", { ascending: true });
    setSummaries(data || []);
    setLoading(false);
  };

  const chartData = useMemo(() => {
    const points: { date: string; value: number }[] = [];
    const paramLower = selectedParam.toLowerCase();

    for (const s of summaries) {
      const text = s.summary_text || "";
      
      // Try to extract from JSON block first
      const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          const params = parsed.parameters || [];
          const found = params.find((p: any) => p.name?.toLowerCase().includes(paramLower));
          if (found && typeof found.value === "number") {
            points.push({ date: s.date_group, value: found.value });
            continue;
          }
        } catch { /* fall through to text parsing */ }
      }

      // Fallback: try to extract from markdown table rows
      // Match patterns like "| Hemoglobin | 10 g/dL |" or "Hemoglobin: 10"
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.toLowerCase().includes(paramLower)) {
          // Try table format: | Param | Value | ...
          const tableCells = line.split("|").map((c: string) => c.trim()).filter(Boolean);
          if (tableCells.length >= 2) {
            const valueStr = tableCells[1];
            const numMatch = valueStr.match(/([\d,]+\.?\d*)/);
            if (numMatch) {
              points.push({ date: s.date_group, value: parseFloat(numMatch[1].replace(/,/g, "")) });
              break;
            }
          }
          // Try "Param: Value" or "Param = Value"
          const colonMatch = line.match(new RegExp(paramLower + "[:\\s=]+([\\d,]+\\.?\\d*)", "i"));
          if (colonMatch) {
            points.push({ date: s.date_group, value: parseFloat(colonMatch[1].replace(/,/g, "")) });
            break;
          }
        }
      }
    }

    return points.slice(-5);
  }, [summaries, selectedParam]);

  // Detect which parameters have data
  const availableParams = useMemo(() => {
    const available = new Set<string>();
    for (const param of PARAMETER_OPTIONS) {
      const pLower = param.toLowerCase();
      for (const s of summaries) {
        const text = (s.summary_text || "").toLowerCase();
        if (text.includes(pLower)) {
          available.add(param);
          break;
        }
      }
    }
    return Array.from(available);
  }, [summaries]);

  // Auto-select first available parameter if current has no data
  useEffect(() => {
    if (chartData.length === 0 && availableParams.length > 0 && !availableParams.includes(selectedParam)) {
      setSelectedParam(availableParams[0]);
    }
  }, [availableParams, chartData.length, selectedParam]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Parameter Trend (Last 5 Reports)
        </h4>
        <Select value={selectedParam} onValueChange={setSelectedParam}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select parameter" />
          </SelectTrigger>
          <SelectContent>
            {PARAMETER_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p} {availableParams.includes(p) ? "" : "(no data)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length < 2 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Not enough historical data available for {selectedParam}.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 4 }}
              activeDot={{ r: 6 }}
              name={selectedParam}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
