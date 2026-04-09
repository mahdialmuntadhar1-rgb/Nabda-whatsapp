import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase, Contact, Template } from "@/lib/supabase";
import { toast } from "sonner";
import { Play, Loader2, Filter, Users } from "lucide-react";

export function CampaignView() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("all");
  const [recipientCount, setRecipientCount] = useState(0);
  const [sendLimit, setSendLimit] = useState<string>("all");
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);

  const sendLimitOptions = [
    { value: "1", label: "1 (Test)" },
    { value: "3", label: "3" },
    { value: "10", label: "10" },
    { value: "20", label: "20" },
    { value: "all", label: "All" }
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    updateRecipientCount();
  }, [selectedCategory, selectedGovernorate, sendLimit]);

  const fetchInitialData = async () => {
    const { data: tData } = await supabase.from("templates").select("*");
    if (tData) setTemplates(tData);

    // Use contact_view for fetching filter options
    const { data: cData } = await supabase.from("contact_view").select("category, governorate");
    if (cData) {
      const cats = Array.from(new Set(cData.map(c => c.category).filter(Boolean))) as string[];
      const govs = Array.from(new Set(cData.map(c => c.governorate).filter(Boolean))) as string[];
      setCategories(cats);
      setGovernorates(govs);
    }
  };

  const updateRecipientCount = async () => {
    // Use contact_view - all contacts are considered valid
    let query = supabase.from("contact_view").select("id", { count: "exact", head: true });
    if (selectedCategory !== "all") query = query.eq("category", selectedCategory);
    if (selectedGovernorate !== "all") query = query.eq("governorate", selectedGovernorate);

    const { count } = await query;
    const total = count || 0;
    
    // Apply send limit to displayed count
    if (sendLimit === "all") {
      setRecipientCount(total);
    } else {
      const limitNum = parseInt(sendLimit, 10);
      setRecipientCount(Math.min(limitNum, total));
    }
  };

  const handleStartCampaign = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    // Confirm before sending
    const isTest = sendLimit === "1";
    const action = isTest ? "send test message" : `send to ${recipientCount} recipients`;
    const confirmed = window.confirm(`Are you sure you want to ${action}?`);

    if (!confirmed) {
      return;
    }

    setIsSending(true);
    setProgress(0);

    try {
      // Build filters
      const filters: any = {};
      if (selectedCategory !== "all") filters.category = selectedCategory;
      if (selectedGovernorate !== "all") filters.governorate = selectedGovernorate;

      // Show toast with campaign info
      const toastId = toast.loading(
        `Starting ${isTest ? "test" : "campaign"}...`,
        { duration: Infinity }
      );

      // Call bulk campaign API with limit
      const response = await fetch("/api/campaign/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          filters: filters,
          limit: sendLimit === "all" ? undefined : parseInt(sendLimit, 10),
          testMode: isTest
        })
      });

      const result = await response.json();

      // Dismiss loading toast
      toast.dismiss(toastId);

      if (result.success) {
        const successMsg = `✅ ${isTest ? "Test" : "Campaign"} complete!\n${result.sent} sent, ${result.failed} failed`;
        toast.success(successMsg);
        setProgress(100);
      } else {
        toast.error("❌ Campaign failed: " + (result.error || "Unknown error"));
      }
    } catch (error: any) {
      toast.error("❌ Campaign error: " + (error.message || "Network error"));
    } finally {
      setIsSending(false);
      setTimeout(() => setProgress(0), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Launch Campaign</CardTitle>
            <CardDescription>Select filters and a template to start sending messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Category
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat, i) => (
                      <SelectItem key={`cat-${cat}-${i}`} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Governorate
                </label>
                <Select value={selectedGovernorate} onValueChange={setSelectedGovernorate}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Governorates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Governorates</SelectItem>
                    {governorates.map((gov, i) => (
                      <SelectItem key={`gov-${gov}-${i}`} value={gov}>{gov}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Message Template</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t, i) => (
                    <SelectItem key={`tpl-${t.id}-${i}`} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Send Limit
                </label>
                <Select value={sendLimit} onValueChange={setSendLimit}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Recipients" />
                  </SelectTrigger>
                  <SelectContent>
                    {sendLimitOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleStartCampaign} 
              disabled={isSending || recipientCount === 0}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending... {progress}%
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Start Campaign
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Audience
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-6">
              <div className="text-4xl font-bold text-blue-700">{recipientCount}</div>
              <p className="text-sm text-muted-foreground mt-1">Target Recipients</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium">{selectedCategory === "all" ? "All" : selectedCategory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Governorate:</span>
                <span className="font-medium">{selectedGovernorate === "all" ? "All" : selectedGovernorate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Send Limit:</span>
                <span className="font-medium text-blue-600">{sendLimit === "all" ? "All" : sendLimit}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
