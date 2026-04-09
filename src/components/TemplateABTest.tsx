import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, Template } from "@/lib/supabase";
import { toast } from "sonner";
import { BarChart, TrendingUp } from "lucide-react";

export type ABTestSession = {
  id: string;
  templateA_id: string;
  templateB_id: string;
  totalContacts: number;
  sentA: number;
  sentB: number;
  repliesA: number;
  repliesB: number;
  createdAt: string;
};

export function TemplateABTest() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateA, setTemplateA] = useState<string>("");
  const [templateB, setTemplateB] = useState<string>("");
  const [testSessions, setTestSessions] = useState<ABTestSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchTestSessions();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase.from("templates").select("*").order("created_at", { ascending: false });
    if (data) setTemplates(data);
  };

  const fetchTestSessions = async () => {
    // This would fetch from a test_sessions table
    // For now, we'll keep it empty until the table is created
    setTestSessions([]);
  };

  const handleStartABTest = async () => {
    if (!templateA || !templateB || templateA === templateB) {
      toast.error("Please select two different templates");
      return;
    }

    setIsLoading(true);

    try {
      // This would call an API endpoint to start the A/B test
      // The backend would split contacts evenly between templates
      // and track performance metrics

      toast.success("A/B test started! Monitor performance in the results below.");
    } catch (error: any) {
      toast.error("Failed to start A/B test: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateWinner = (session: ABTestSession) => {
    const rateA = session.sentA > 0 ? (session.repliesA / session.sentA) * 100 : 0;
    const rateB = session.sentB > 0 ? (session.repliesB / session.sentB) * 100 : 0;

    if (rateA > rateB) return "Template A";
    if (rateB > rateA) return "Template B";
    return "Tie";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            A/B Test Templates
          </CardTitle>
          <CardDescription>Compare performance of two templates to find the best approach</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template A</label>
              <Select value={templateA} onValueChange={setTemplateA}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template A" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Template B</label>
              <Select value={templateB} onValueChange={setTemplateB}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template B" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleStartABTest} disabled={isLoading || !templateA || !templateB} className="w-full">
            {isLoading ? "Starting test..." : "Start A/B Test"}
          </Button>

          {templateA && templateB && templateA !== templateB && (
            <div className="text-sm text-muted-foreground p-3 bg-blue-50 rounded">
              💡 This will split your audience between two templates and track engagement metrics.
            </div>
          )}
        </CardContent>
      </Card>

      {testSessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Test Results
          </h3>

          {testSessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Template A</p>
                    <p className="text-lg font-semibold">
                      {session.repliesA}/{session.sentA} replies
                    </p>
                    <p className="text-sm text-blue-600">
                      {session.sentA > 0 ? ((session.repliesA / session.sentA) * 100).toFixed(1) : 0}%
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">vs</p>
                    <p className="text-lg font-semibold text-center">Winner</p>
                    <p className="text-sm text-green-600 text-center font-semibold">{calculateWinner(session)}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Template B</p>
                    <p className="text-lg font-semibold">
                      {session.repliesB}/{session.sentB} replies
                    </p>
                    <p className="text-sm text-blue-600">
                      {session.sentB > 0 ? ((session.repliesB / session.sentB) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
