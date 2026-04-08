import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeIraqiPhone } from "@/lib/phone-utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Upload, Database } from "lucide-react";

export function ImportPanel({ onImportComplete }: { onImportComplete: () => void }) {
  const [excelData, setExcelData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<{
    valid: any[];
    invalid: any[];
    duplicates: number;
  } | null>(null);

  const handleParse = () => {
    if (!excelData.trim()) return;

    const lines = excelData.split("\n").filter(line => line.trim());
    const seenPhones = new Set<string>();
    const valid: any[] = [];
    const invalid: any[] = [];
    let duplicates = 0;

    lines.forEach((line) => {
      // Split by tab or comma (common Excel copy-paste formats)
      const parts = line.split(/\t|,/);
      const name = parts[0]?.trim() || "Unknown";
      const phone = parts[1]?.trim() || "";
      const category = parts[2]?.trim() || "";
      const governorate = parts[3]?.trim() || "";

      const normalized = normalizeIraqiPhone(phone);

      if (!normalized) {
        invalid.push({ name, phone, category, governorate });
      } else if (seenPhones.has(normalized)) {
        duplicates++;
      } else {
        seenPhones.add(normalized);
        valid.push({
          display_name: name,
          raw_phone: phone,
          normalized_phone: normalized,
          category,
          governorate,
          validity_status: "valid",
        });
      }
    });

    setPreview({ valid, invalid, duplicates });
  };

  const handleSave = async () => {
    if (!preview || preview.valid.length === 0) return;

    setIsImporting(true);
    try {
      const { error } = await supabase.from("contacts").upsert(preview.valid, {
        onConflict: "normalized_phone",
      });

      if (error) throw error;

      toast.success(`Successfully imported ${preview.valid.length} contacts`);
      setExcelData("");
      setPreview(null);
      onImportComplete();
    } catch (error: any) {
      toast.error("Import failed: " + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Excel Paste Import</CardTitle>
          <CardDescription>
            Paste data from Excel. Format: Name [Tab] Phone [Tab] Category [Tab] Governorate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="John Doe	07701234567	Retail	Baghdad"
            className="min-h-[200px] font-mono text-sm"
            value={excelData}
            onChange={(e) => setExcelData(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={handleParse} variant="secondary">
              Preview Data
            </Button>
            {preview && (
              <Button onClick={handleSave} disabled={isImporting}>
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save {preview.valid.length} Contacts
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-green-50 border-green-100">
            <CardHeader className="py-4">
              <CardTitle className="text-sm text-green-700">Valid Contacts</CardTitle>
              <div className="text-2xl font-bold text-green-800">{preview.valid.length}</div>
            </CardHeader>
          </Card>
          <Card className="bg-red-50 border-red-100">
            <CardHeader className="py-4">
              <CardTitle className="text-sm text-red-700">Invalid Numbers</CardTitle>
              <div className="text-2xl font-bold text-red-800">{preview.invalid.length}</div>
            </CardHeader>
          </Card>
          <Card className="bg-orange-50 border-orange-100">
            <CardHeader className="py-4">
              <CardTitle className="text-sm text-orange-700">Duplicates Removed</CardTitle>
              <div className="text-2xl font-bold text-orange-800">{preview.duplicates}</div>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  );
}
