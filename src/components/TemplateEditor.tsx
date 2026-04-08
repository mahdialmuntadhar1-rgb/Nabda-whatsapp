import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase, Template } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

export function TemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase.from("templates").select("*").order("created_at", { ascending: false });
    if (data) setTemplates(data);
  };

  const handleSave = async () => {
    if (!name || !content) return;

    const templateData = { name, content };

    try {
      if (editingId) {
        await supabase.from("templates").update(templateData).eq("id", editingId);
        toast.success("Template updated");
      } else {
        await supabase.from("templates").insert([templateData]);
        toast.success("Template created");
      }
      setName("");
      setContent("");
      setEditingId(null);
      fetchTemplates();
    } catch (error: any) {
      toast.error("Error saving template");
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("templates").delete().eq("id", id);
    fetchTemplates();
    toast.success("Template deleted");
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Template" : "New Template"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Template Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome Message" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Content</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Hello {{name}}, welcome to our {{category}} service!"
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{name}}"} and {"{{category}}"} as placeholders.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => { setEditingId(null); setName(""); setContent(""); }}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Existing Templates</h3>
        {templates.map((template, i) => (
          <Card key={`${template.id}-${i}`} className="group">
            <CardContent className="p-4 flex justify-between items-start">
              <div className="space-y-1">
                <h4 className="font-medium">{template.name}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">{template.content}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingId(template.id);
                    setName(template.name);
                    setContent(template.content);
                  }}
                >
                  <Plus className="h-4 w-4 rotate-45" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(template.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
