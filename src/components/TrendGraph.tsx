import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

function extractValueFromText(text: string, paramLower: string): number | null {
  // 1. Try JSON block
  const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const params = parsed.parameters || [];
      const found = params.find((p: any) => p.name?.toLowerCase().includes(paramLower));
      if (found && typeof found.value === "number") return found.value;
    } catch { /* fall through */ }
  }

  // 2. Try markdown table rows: | Param | Value | Range | Status |
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.toLowerCase().includes(paramLower)) continue;
    
    // Table format
    const cells = line.split("|").map(c => c.trim()).filter(Boolean);
    if (cells.length >= 2) {
      const valueStr = cells[1];
      const numMatch = valueStr.match(/([\d,]+\.?\d*)/);
      if (numMatch) return parseFloat(numMatch[1].replace(/,/g, ""));
    }
    
    // "Param: Value" format
    const colonMatch = line.match(new RegExp(paramLower + "[:\\s=]+([\\d,]+\\.?\\d*)", "i"));
    if (colonMatch) return parseFloat(colonMatch[1].replace(/,/g, ""));
  }

  return null;
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
      const val = extractValueFromText(s.summary_text || "", paramLower);
      if (val !== null) {
        points.push({ date: s.date_group, value: val });
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
        const val = extractValueFromText(s.summary_text || "", pLower);
        if (val !== null) {
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
      <div className="mt-4 pt-4 border-t border-border">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (summaries.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="font-semibold text-xs flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
          <TrendingUp className="w-3.5 h-3.5 text-primary" /> Parameter Trend
        </h4>
        <Select value={selectedParam} onValueChange={setSelectedParam}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Select parameter" />
          </SelectTrigger>
          <SelectContent>
            {PARAMETER_OPTIONS.map((p) => (
              <SelectItem key={p} value={p} className="text-xs">
                {p} {availableParams.includes(p) ? "" : "(no data)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length < 1 ? (
        <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
          Not enough historical data available for {selectedParam}.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 5, right: 15, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "11px",
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
