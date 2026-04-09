import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { normalizeIraqiPhone } from "@/lib/phone-utils";
import { toast } from "sonner";
import { Loader2, Database, Link2 } from "lucide-react";

export function SupabaseImport({ onImportComplete }: { onImportComplete: () => void }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [tableName, setTableName] = useState("businesses");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [data, setData] = useState<any[] | null>(null);

  const handleConnect = async () => {
    if (!url || !key) return;
    setIsConnecting(true);
    try {
      // We use a temporary client to fetch from the other project
      const { createClient } = await import("@supabase/supabase-js");
      const tempClient = createClient(url, key);
      
      const { data: fetched, error } = await tempClient.from(tableName).select("*").limit(1000);
      if (error) throw error;
      
      setData(fetched);
      toast.success(`Connected! Found ${fetched.length} rows.`);
    } catch (error: any) {
      toast.error("Connection failed: " + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleImport = async () => {
    if (!data) return;
    setIsImporting(true);
    try {
      const processed = data.map(row => {
        const phone = row.phone || row.whatsapp || row.phone_1 || row.phone_2 || "";
        const normalized = normalizeIraqiPhone(phone);
        return {
          display_name: row.display_name || row.name || "Unknown",
          raw_phone: phone,
          normalized_phone: normalized || `invalid_${Math.random()}`,
          category: row.category || "",
          governorate: row.governorate || "",
          validity_status: normalized ? "valid" : "invalid",
        };
      }).filter(c => c.validity_status === "valid");

      const { error } = await supabase.from("contacts").upsert(processed, {
        onConflict: "normalized_phone",
      });

      if (error) throw error;
      toast.success(`Imported ${processed.length} valid contacts`);
      onImportComplete();
      setData(null);
    } catch (error: any) {
      toast.error("Import failed: " + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-green-600" />
          Supabase Project Import
        </CardTitle>
        <CardDescription>Connect to another Supabase project to fetch contacts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xyz.supabase.co" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Anon Key</label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder="eyJhbG..." />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Table Name</label>
          <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="businesses" />
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleConnect} disabled={isConnecting} variant="secondary">
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect & Fetch
          </Button>
          {data && (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {data.length} Rows
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
