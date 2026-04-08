import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase client (server-side with service role)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Nabda API config
const NABDA_API_URL = process.env.NABDA_API_URL || "https://api.nabdaotp.com/inst/84cf1e71-6f8d-4411-9e58-de6a18e6007c";
const NABDA_INSTANCE_ID = process.env.NABDA_INSTANCE_ID || "84cf1e71-6f8d-4411-9e58-de6a18e6007c";
const NABDA_API_TOKEN = process.env.NABDA_API_TOKEN || "sk_40e90a8b16fa4265a8f54ea3cc96b87d";

// Rate limiting config
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000; // 2 seconds between batches

// Send single message via Nabda API
async function sendNabdaMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; provider: string }> {
  // Format phone (remove + if present for Nabda)
  const formattedPhone = phone.replace(/^\+/, "");

  const response = await fetch(`${NABDA_API_URL}/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${NABDA_API_TOKEN}`,
      "X-Instance-ID": NABDA_INSTANCE_ID
    },
    body: JSON.stringify({
      phone: formattedPhone,
      message: message
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Nabda API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  return {
    success: true,
    messageId: data.messageId || data.id,
    provider: "nabda"
  };
}

// Log send result to Supabase
async function logSendResult(
  contactId: string,
  phone: string,
  message: string,
  status: "sent" | "failed",
  errorMessage?: string,
  messageId?: string
): Promise<void> {
  try {
    // 1. Insert into messages table
    const { data: messageRecord, error: msgError } = await supabaseAdmin
      .from("messages")
      .insert({
        contact_id: contactId,
        normalized_phone: phone,
        message: message,
        status: status,
        error: errorMessage || null,
        sent_at: status === "sent" ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (msgError) {
      console.error("[Log] Failed to insert message:", msgError);
      return;
    }

    // 2. Insert into send_logs table
    const { error: logError } = await supabaseAdmin
      .from("send_logs")
      .insert({
        message_id: messageRecord.id,
        provider: "nabda",
        status: status,
        response: { messageId, phone, error: errorMessage }
      });

    if (logError) {
      console.error("[Log] Failed to insert send_log:", logError);
    }
  } catch (err) {
    console.error("[Log] Failed to log send result:", err);
  }
}

// Send campaign in batches with rate limiting
async function sendCampaignBatches(
  contacts: any[],
  messageTemplate: string
): Promise<{ sent: number; failed: number; batches: number }> {
  let sent = 0;
  let failed = 0;
  const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);

  console.log(`[Campaign] Starting ${contacts.length} contacts in ${totalBatches} batches...`);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, contacts.length);
    const batch = contacts.slice(start, end);

    console.log(`[Campaign] Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} contacts)...`);

    // Process batch in parallel
    const batchPromises = batch.map(async (contact) => {
      try {
        // Use whatsapp_phone if available, otherwise normalized_phone
        const phone = contact.whatsapp_phone || contact.normalized_phone;
        
        if (!phone) {
          throw new Error("No phone number available");
        }

        const result = await sendNabdaMessage(phone, messageTemplate);
        
        await logSendResult(
          contact.id,
          contact.normalized_phone,
          messageTemplate,
          "sent",
          undefined,
          result.messageId
        );

        sent++;
        console.log(`[Sent] ${contact.display_name || contact.id} → ${phone}`);
        
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        
        await logSendResult(
          contact.id,
          contact.normalized_phone || "",
          messageTemplate,
          "failed",
          errorMsg
        );

        console.error(`[Failed] ${contact.display_name || contact.id}: ${errorMsg}`);
      }
    });

    await Promise.all(batchPromises);

    // Rate limiting delay between batches (except for last batch)
    if (batchIndex < totalBatches - 1) {
      console.log(`[Campaign] Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  console.log(`[Campaign] Complete! Sent: ${sent}, Failed: ${failed}`);
  
  return { sent, failed, batches: totalBatches };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok",
      nabdaConfigured: !!NABDA_API_TOKEN,
      supabaseConfigured: !!supabaseServiceKey
    });
  });

  // Single message send via Nabda API
  app.post("/api/send-whatsapp", async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    try {
      const result = await sendNabdaMessage(phone, message);
      return res.json(result);
    } catch (error) {
      console.error("[Nabda] Send failed:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        provider: "nabda"
      });
    }
  });

  // Campaign bulk send with rate limiting
  app.post("/api/campaign/send", async (req, res) => {
    const { templateId, filters = {}, testMode = false } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: "templateId is required" });
    }

    try {
      // 1. Fetch template content
      const { data: template, error: templateError } = await supabaseAdmin
        .from("templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (templateError || !template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // 2. Build contact query with filters
      let contactQuery = supabaseAdmin
        .from("contacts")
        .select("*")
        .eq("validity_status", "valid")
        .eq("ready_to_send", true);

      if (filters.governorate) {
        contactQuery = contactQuery.eq("governorate", filters.governorate);
      }
      if (filters.category) {
        contactQuery = contactQuery.eq("category", filters.category);
      }
      if (testMode) {
        contactQuery = contactQuery.limit(1);
      }

      const { data: contacts, error: contactsError } = await contactQuery;

      if (contactsError) {
        throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
      }

      if (!contacts || contacts.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No contacts match the filters",
          sent: 0,
          failed: 0,
          total: 0
        });
      }

      // 3. Process in batches with rate limiting
      const results = await sendCampaignBatches(contacts, template.content);

      return res.json({
        success: true,
        campaignId: templateId,
        total: contacts.length,
        sent: results.sent,
        failed: results.failed,
        batches: results.batches,
        provider: "nabda"
      });

    } catch (error) {
      console.error("[Campaign] Failed:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Campaign failed"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
