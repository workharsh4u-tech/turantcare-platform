import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Upload, FileUp, Check, X, FlaskConical } from "lucide-react";

interface ReportUploaderProps {
  patientId: string;
  uploadedByRole: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReportUploader({ patientId, uploadedByRole, onClose, onSuccess }: ReportUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [reportType, setReportType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const generateDemoReport = () => {
    const reportTypes = ["Blood Test - CBC", "Lipid Profile", "Thyroid Panel", "Liver Function Test", "Kidney Function Test"];
    const randomType = reportTypes[Math.floor(Math.random() * reportTypes.length)];
    setReportType(randomType);

    // Generate a simple text-based PDF blob
    const now = new Date().toLocaleString();
    const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 420>>
stream
BT
/F1 18 Tf 50 740 Td (TurantCare - ${randomType}) Tj
/F1 12 Tf 0 -30 Td (Patient Report - Demo/Sample) Tj
0 -20 Td (Generated: ${now}) Tj
0 -30 Td (--- Results ---) Tj
0 -20 Td (Hemoglobin: 14.2 g/dL [Normal: 13.5-17.5]) Tj
0 -20 Td (WBC Count: 7,500 /uL [Normal: 4,500-11,000]) Tj
0 -20 Td (Platelet Count: 250,000 /uL [Normal: 150,000-400,000]) Tj
0 -20 Td (RBC Count: 5.1 M/uL [Normal: 4.7-6.1]) Tj
0 -20 Td (Blood Sugar Fasting: 95 mg/dL [Normal: 70-100]) Tj
0 -20 Td (Cholesterol Total: 185 mg/dL [Normal: <200]) Tj
0 -30 Td (Status: All values within normal range.) Tj
0 -30 Td (Note: This is a demo report for testing purposes only.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000340 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
810
%%EOF`;

    const blob = new Blob([pdfContent], { type: "application/pdf" });
    const file = new File([blob], `demo-${randomType.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`, { type: "application/pdf" });
    setFiles([file]);
    toast({ title: "Demo report generated", description: `${randomType} — ready to upload` });
  };

  const handleUpload = async () => {
    if (!files.length || !user) return;
    setUploading(true);

    try {
      const dateGroup = new Date().toISOString().split("T")[0];

      for (const file of files) {
        const filePath = `${patientId}/${dateGroup}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("medical-reports")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("medical-reports")
          .getPublicUrl(filePath);

        const { error: dbError } = await supabase.from("report_files").insert({
          patient_id: patientId,
          date_group: dateGroup,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          report_type: reportType || null,
          uploaded_by_role: uploadedByRole,
          uploaded_by_id: user.id,
        });

        if (dbError) throw dbError;
      }

      setDone(true);
      toast({ title: "Reports uploaded successfully!" });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-elevated p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-success" />
          </div>
          <h3 className="font-display text-xl font-bold mb-2">Upload Complete!</h3>
          <p className="text-muted-foreground">{files.length} file(s) uploaded successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-elevated p-8 max-w-md w-full border border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-bold flex items-center gap-2">
            <Upload className="w-5 h-5" /> Upload Reports
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Report Type (optional)</Label>
            <Input value={reportType} onChange={(e) => setReportType(e.target.value)} placeholder="e.g. Blood Test, X-Ray, MRI" />
          </div>

          <div>
            <Label>Files (PDF / Images)</Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <Button variant="outline" className="w-full mt-1.5 h-20 border-dashed" onClick={() => fileRef.current?.click()}>
              <div className="text-center">
                <FileUp className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {files.length ? `${files.length} file(s) selected` : "Click to choose files"}
                </span>
              </div>
            </Button>
            <Button variant="outline" size="sm" className="w-full mt-2 text-xs gap-1.5" onClick={generateDemoReport}>
              <FlaskConical className="w-3.5 h-3.5" /> Generate Demo Report
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="text-sm text-muted-foreground flex items-center gap-2 p-2 bg-muted rounded">
                  <FileUp className="w-3 h-3" /> {f.name}
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleUpload} disabled={!files.length || uploading} className="w-full gradient-primary text-primary-foreground">
            {uploading ? "Uploading..." : `Upload ${files.length} File(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
