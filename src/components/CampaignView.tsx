import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase, Contact, Template } from "@/lib/supabase";
import { toast } from "sonner";
import { Play, Loader2, Filter, Users, Plus } from "lucide-react";

export function CampaignView() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("all");
  const [testMode, setTestMode] = useState<string>("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    updateRecipientCount();
  }, [selectedCategory, selectedGovernorate]);

  const createTestTemplate = async () => {
    try {
      const testTemplates = [
        {
          name: "Test Template",
          content: "Hello {{name}}, this is a test message from our WhatsApp CRM."
        },
        {
          name: "Business Introduction",
          content: "Hello {{name}}, we'd like to introduce our business services to you. Best regards from {{category}} team."
        },
        {
          name: "Follow-up Message",
          content: "Hi {{name}}, following up on our previous message. Are you interested in learning more about our services?"
        }
      ];

      for (const template of testTemplates) {
        const { data, error } = await supabase.from("templates").insert([template]).select().single();
        if (error) {
          console.error("Error creating template:", error);
        } else {
          console.log("Created template:", data);
        }
      }
      
      toast.success("Test templates created!");
      fetchInitialData(); // Refresh templates
    } catch (error) {
      console.error("Error creating test templates:", error);
      toast.error("Error creating templates");
    }
  };

  const fetchInitialData = async () => {
    try {
      const { data: tData, error: tError } = await supabase.from("templates").select("*");
      if (tError) {
        console.error("Error fetching templates:", tError);
        toast.error("Error loading templates");
      } else {
        console.log("Templates loaded:", tData);
        setTemplates(tData || []);
        if (!tData || tData.length === 0) {
          console.log("No templates found, creating default template");
          // Create a default template if none exist
          const { data: newTemplate } = await supabase.from("templates").insert([{
            name: "Default Template",
            content: "Hello {{name}}, this is a test message from our WhatsApp CRM."
          }]).select().single();
          if (newTemplate) {
            setTemplates([newTemplate]);
          }
        }
      }

      const { data: cData, error: cError } = await supabase.from("contacts").select("category, governorate");
      if (cError) {
        console.error("Error fetching contacts:", cError);
      } else if (cData) {
        const cats = Array.from(new Set(cData.map(c => c.category).filter(Boolean))) as string[];
        const govs = Array.from(new Set(cData.map(c => c.governorate).filter(Boolean))) as string[];
        setCategories(cats);
        setGovernorates(govs);
      }
    } catch (error) {
      console.error("Error in fetchInitialData:", error);
      toast.error("Error loading data");
    }
  };

  const updateRecipientCount = async () => {
    let query = supabase.from("contacts").select("id", { count: "exact", head: true }).eq("validity_status", "valid");
    if (selectedCategory !== "all") query = query.eq("category", selectedCategory);
    if (selectedGovernorate !== "all") query = query.eq("governorate", selectedGovernorate);

    const { count } = await query;
    setRecipientCount(count || 0);
  };

  const handleStartCampaign = async () => {
    console.log("Starting campaign with template ID:", selectedTemplate);
    console.log("Available templates:", templates);
    console.log("Test mode:", testMode);
    
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    console.log("Found template:", template);
    
    if (!template) {
      toast.error("Template not found. Please select a valid template.");
      return;
    }

    // Validate template content
    if (!template.content) {
      console.error("Template content is undefined:", template);
      toast.error("Template content is missing. Please create a valid template.");
      return;
    }

    console.log("Template content:", template.content);

    setIsSending(true);
    setProgress(0);

    try {
      let recipients = [];
      
      // Handle test modes
      if (testMode) {
        // Your phone number for testing
        const testPhone = "+9647701234567"; // Replace with your actual phone number
        
        if (testMode === "test" || testMode === "test1") {
          recipients = [{
            id: "test-contact",
            display_name: "Test User",
            normalized_phone: testPhone,
            category: "test",
            governorate: "Baghdad"
          }];
        } else if (testMode === "test3") {
          recipients = Array(3).fill(null).map((_, i) => ({
            id: `test-contact-${i}`,
            display_name: `Test User ${i + 1}`,
            normalized_phone: testPhone,
            category: "test",
            governorate: "Baghdad"
          }));
        } else if (testMode === "test10") {
          recipients = Array(10).fill(null).map((_, i) => ({
            id: `test-contact-${i}`,
            display_name: `Test User ${i + 1}`,
            normalized_phone: testPhone,
            category: "test",
            governorate: "Baghdad"
          }));
        } else if (testMode === "testall") {
          // Fetch all recipients for test all mode
          let query = supabase.from("contacts").select("*").eq("validity_status", "valid");
          if (selectedCategory !== "all") query = query.eq("category", selectedCategory);
          if (selectedGovernorate !== "all") query = query.eq("governorate", selectedGovernorate);
          const { data: allRecipients } = await query;
          recipients = allRecipients || [];
        }
        
        toast.info(`Starting test campaign for ${recipients.length} messages...`);
      } else {
        // Normal campaign mode
        let query = supabase.from("contacts").select("*").eq("validity_status", "valid");
        if (selectedCategory !== "all") query = query.eq("category", selectedCategory);
        if (selectedGovernorate !== "all") query = query.eq("governorate", selectedGovernorate);

        const { data: campaignRecipients } = await query;
        recipients = campaignRecipients || [];
        
        toast.info(`Starting campaign for ${recipients.length} recipients...`);
      }
      
      if (!recipients || recipients.length === 0) {
        toast.error("No recipients found");
        setIsSending(false);
        return;
      }

      for (let i = 0; i < recipients.length; i++) {
        const contact = recipients[i];
        
        // Replace placeholders with proper error handling
        let messageText = template.content || "Hello, this is a test message.";
        
        try {
          messageText = messageText
            .replace(/{{name}}/g, contact.display_name || "Friend")
            .replace(/{{category}}/g, contact.category || "Business")
            .replace(/{{governorate}}/g, contact.governorate || "Iraq");
        } catch (error) {
          console.error("Error replacing placeholders:", error);
          messageText = "Hello, this is a test message.";
        }

        // Create message record
        const { data: msgData, error: msgError } = await supabase.from("messages").insert([{
          contact_id: contact.id,
          normalized_phone: contact.normalized_phone,
          message: messageText,
          status: "pending"
        }]).select().single();

        if (msgError) continue;

        // Call our backend to send the message
        try {
          const response = await fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: contact.normalized_phone,
              message: messageText
            })
          });

          const result = await response.json();

          if (result.success) {
            await supabase.from("messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", msgData.id);
            await supabase.from("send_logs").insert([{
              message_id: msgData.id,
              status: "success",
              response: result
            }]);
          } else {
            await supabase.from("messages").update({ status: "failed", error: result.error }).eq("id", msgData.id);
          }
        } catch (err) {
          await supabase.from("messages").update({ status: "failed", error: "Network error" }).eq("id", msgData.id);
        }

        setProgress(Math.round(((i + 1) / recipients.length) * 100));
        
        // Rate limiting: 4 seconds between messages
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      }

      toast.success("Campaign completed!");
    } catch (error: any) {
      toast.error("Campaign failed: " + error.message);
    } finally {
      setIsSending(false);
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
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat, i) => (
                    <option key={`cat-${cat}-${i}`} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Governorate
                </label>
                <select 
                  value={selectedGovernorate} 
                  onChange={(e) => setSelectedGovernorate(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="all">All Governorates</option>
                  {governorates.map((gov, i) => (
                    <option key={`gov-${gov}-${i}`} value={gov}>{gov}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message Template</label>
              <select 
                value={selectedTemplate} 
                onChange={(e) => {
                  console.log("Template selected:", e.target.value);
                  setSelectedTemplate(e.target.value);
                }}
                className="w-full h-8 px-2.5 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Select a template</option>
                {templates.map((t, i) => (
                  <option key={`tpl-${t.id}-${i}`} value={t.id}>
                    {t.name} {t.id === selectedTemplate ? "(Selected)" : ""}
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">No templates available.</p>
                  <Button 
                    onClick={createTestTemplate}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Test Templates
                  </Button>
                </div>
              )}
              {templates.length > 0 && (
                <Button 
                  onClick={createTestTemplate}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add More Templates
                </Button>
              )}
              {selectedTemplate && (
                <p className="text-xs text-muted-foreground">
                  Selected: {templates.find(t => t.id === selectedTemplate)?.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Test Mode</label>
              <select 
                value={testMode} 
                onChange={(e) => setTestMode(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Select test mode</option>
                <option value="test">Test (1 message)</option>
                <option value="test1">Test 1 (1 message)</option>
                <option value="test3">Test 3 (3 messages)</option>
                <option value="test10">Test 10 (10 messages)</option>
                <option value="testall">Test All (all recipients)</option>
              </select>
            </div>

            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleStartCampaign} 
              disabled={isSending || (recipientCount === 0 && !testMode)}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {testMode ? `Testing... ${progress}%` : `Sending... ${progress}%`}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  {testMode ? `Start Test (${testMode.toUpperCase()})` : "Start Campaign"}
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
              <div className="text-4xl font-bold text-blue-700">
                {testMode ? (
                  testMode === "test" || testMode === "test1" ? 1 :
                  testMode === "test3" ? 3 :
                  testMode === "test10" ? 10 :
                  testMode === "testall" ? recipientCount : recipientCount
                ) : recipientCount}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {testMode ? "Test Messages" : "Target Recipients"}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              {testMode && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode:</span>
                  <span className="font-medium text-orange-600">{testMode.toUpperCase()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium">{selectedCategory === "all" ? "All" : selectedCategory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Governorate:</span>
                <span className="font-medium">{selectedGovernorate === "all" ? "All" : selectedGovernorate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={testMode ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                  {testMode ? "Test Mode" : "Valid Only"}
                </span>
              </div>
              {testMode && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium text-xs">+9647701234567</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
