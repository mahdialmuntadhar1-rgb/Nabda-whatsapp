import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export function LogsView() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchLogs();
    const subscription = supabase
      .channel("messages-logs")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, fetchLogs)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("messages")
      .select(`
        *,
        contacts (display_name)
      `)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (data) setLogs(data);
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipient</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No logs found.
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log, i) => (
              <TableRow key={`${log.id}-${i}`}>
                <TableCell className="font-medium">{log.contacts?.display_name || "Unknown"}</TableCell>
                <TableCell className="font-mono text-xs">{log.normalized_phone}</TableCell>
                <TableCell className="max-w-xs truncate text-xs">{log.message}</TableCell>
                <TableCell>
                  <Badge 
                    variant={
                      log.status === "sent" ? "default" : 
                      log.status === "failed" ? "destructive" : 
                      "secondary"
                    }
                  >
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "HH:mm:ss, MMM d")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
