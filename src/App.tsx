import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardStats } from "@/components/DashboardStats";
import { ImportPanel } from "@/components/ImportPanel";
import { ContactsTable } from "@/components/ContactsTable";
import { TemplateEditor } from "@/components/TemplateEditor";
import { CampaignView } from "@/components/CampaignView";
import { LogsView } from "@/components/LogsView";
import { SupabaseImport } from "@/components/SupabaseImport";
import { supabase, Contact } from "@/lib/supabase";
import { Toaster } from "sonner";
import { LayoutDashboard, Users, Upload, FileText, Send, History } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState({
    totalContacts: 0,
    validContacts: 0,
    invalidContacts: 0,
    duplicatesRemoved: 0,
    sentCount: 0,
    failedCount: 0,
    pendingCount: 0,
    repliesCount: 0,
  });

  useEffect(() => {
    fetchData();
    
    // Real-time subscriptions
    const contactsSub = supabase.channel('contacts-all').on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchData).subscribe();
    const messagesSub = supabase.channel('messages-all').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchData).subscribe();

    return () => {
      supabase.removeChannel(contactsSub);
      supabase.removeChannel(messagesSub);
    };
  }, []);

  const fetchData = async () => {
    if (!supabase) return;
    const { data: cData } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
    if (cData) setContacts(cData);

    const { data: mData } = await supabase.from("messages").select("status");
    
    const sent = mData?.filter(m => m.status === "sent").length || 0;
    const failed = mData?.filter(m => m.status === "failed").length || 0;
    const pending = mData?.filter(m => m.status === "pending").length || 0;
    const replied = mData?.filter(m => m.status === "replied").length || 0;

    setStats({
      totalContacts: cData?.length || 0,
      validContacts: cData?.filter(c => c.validity_status === "valid").length || 0,
      invalidContacts: cData?.filter(c => c.validity_status === "invalid").length || 0,
      duplicatesRemoved: 0, // This is tracked during import
      sentCount: sent,
      failedCount: failed,
      pendingCount: pending,
      repliesCount: replied,
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans selection:bg-blue-100">
      <Toaster position="top-right" richColors />
      
      {!supabase && (
        <div className="bg-amber-50 border-b border-amber-200 p-4 text-center text-amber-800 text-sm font-medium">
          ⚠️ Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
        </div>
      )}
      <header className="sticky top-0 z-50 w-full border-bottom bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Nabda CRM</h1>
            <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded tracking-wider">Beta</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected to Supabase
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            <TabsList className="bg-white border border-slate-200 p-1 h-12">
              <TabsTrigger value="overview" className="gap-2 px-4"><LayoutDashboard className="w-4 h-4" /> Overview</TabsTrigger>
              <TabsTrigger value="contacts" className="gap-2 px-4"><Users className="w-4 h-4" /> Contacts</TabsTrigger>
              <TabsTrigger value="import" className="gap-2 px-4"><Upload className="w-4 h-4" /> Import</TabsTrigger>
              <TabsTrigger value="templates" className="gap-2 px-4"><FileText className="w-4 h-4" /> Templates</TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-2 px-4"><Send className="w-4 h-4" /> Campaigns</TabsTrigger>
              <TabsTrigger value="logs" className="gap-2 px-4"><History className="w-4 h-4" /> Logs</TabsTrigger>
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <TabsContent key="overview" value="overview" className="space-y-8 focus-visible:outline-none">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <DashboardStats {...stats} />
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                      <CardDescription>Latest message statuses and contact additions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LogsView />
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <Button variant="outline" className="justify-start h-12" onClick={() => setActiveTab("import")}>
                        <Upload className="mr-2 h-4 w-4" /> Import New Contacts
                      </Button>
                      <Button variant="outline" className="justify-start h-12" onClick={() => setActiveTab("campaigns")}>
                        <Send className="mr-2 h-4 w-4" /> Launch New Campaign
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent key="contacts" value="contacts" className="focus-visible:outline-none">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Contact Directory</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Export CSV</Button>
                  </div>
                </div>
                <ContactsTable contacts={contacts} />
              </motion.div>
            </TabsContent>

            <TabsContent key="import" value="import" className="focus-visible:outline-none space-y-8">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <ImportPanel onImportComplete={fetchData} />
                <SupabaseImport onImportComplete={fetchData} />
              </motion.div>
            </TabsContent>

            <TabsContent key="templates" value="templates" className="focus-visible:outline-none">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <TemplateEditor />
              </motion.div>
            </TabsContent>

            <TabsContent key="campaigns" value="campaigns" className="focus-visible:outline-none">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <CampaignView />
              </motion.div>
            </TabsContent>

            <TabsContent key="logs" value="logs" className="focus-visible:outline-none">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-2xl font-bold mb-6">Message History</h2>
                <LogsView />
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>

      <footer className="mt-auto py-8 border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          &copy; 2026 Nabda CRM &bull; Built for Iraq Business Outreach
        </div>
      </footer>
    </div>
  );
}
