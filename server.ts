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

// Personalization helper - replace template placeholders
function personalizeMessage(
  template: string,
  contact: any
): string {
  let message = template;

  // Support multiple placeholder formats
  const placeholders: Record<string, string> = {
    "{{name}}": contact.name || contact.display_name || "",
    "{{1}}": contact.name || contact.display_name || "",
    "{{governorate}}": contact.governorate || "",
    "{{2}}": contact.governorate || "",
    "{{category}}": contact.category || "",
    "{{3}}": contact.category || "",
    "{{phone}}": contact.phone || contact.whatsapp_phone || "",
    "{{4}}": contact.phone || contact.whatsapp_phone || ""
  };

  Object.entries(placeholders).forEach(([key, value]) => {
    message = message.replace(new RegExp(key, "g"), value);
  });

  return message;
}

// Send single message via Nabda API
async function sendNabdaMessage(
  phone: string,
  message: string,
  variables?: string[]
): Promise<{ success: boolean; messageId?: string; provider: string }> {
  // Format phone (remove + if present for Nabda)
  const formattedPhone = phone.replace(/^\+/, "");

  try {
    const response = await fetch(`${NABDA_API_URL}/send`, {
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

    // Read response as text first to avoid JSON parsing errors
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
    }

    // Try to parse JSON, handle non-JSON responses
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response from Nabda: ${responseText.substring(0, 200)}`);
    }

    return {
      success: true,
      messageId: data.messageId || data.id || data.message_id,
      provider: "nabda"
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Failed to send via Nabda: ${errorMsg}`);
  }
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
      let phone: string | undefined;
      try {
        // Use phone from contact_view, fallback to whatsapp_phone
        phone = contact.phone || contact.whatsapp_phone;

        if (!phone) {
          throw new Error("No phone number available");
        }

        // Personalize message with contact data
        const personalizedMessage = personalizeMessage(messageTemplate, contact);

        // Build variables array for template variables support
        const variables = [
          contact.name || "",
          contact.governorate || "",
          contact.category || ""
        ];

        const result = await sendNabdaMessage(phone, personalizedMessage, variables);

        await logSendResult(
          contact.id,
          phone,
          personalizedMessage,
          "sent",
          undefined,
          result.messageId
        );

        sent++;
        console.log(`[Sent] ${contact.display_name || contact.id} (${contact.governorate}/${contact.category}) → ${phone}`);

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";

        // Use personalized message in logs if available
        const personalizedMessage = personalizeMessage(messageTemplate, contact);

        await logSendResult(
          contact.id,
          phone,
          personalizedMessage,
          "failed",
          errorMsg
        );

        console.error(`[Failed] ${contact.name || contact.id}: ${errorMsg}`);
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

  // Webhook for Nabda delivery/reply status updates
  app.post("/api/webhooks/nabda", async (req, res) => {
    try {
      const { event, payload } = req.body;

      console.log(`[Webhook] Received Nabda event: ${event}`, payload);

      // Handle different webhook events
      if (event === "message.sent") {
        // Message sent successfully
        const { messageId, phone, status } = payload;
        console.log(`[Webhook] Message ${messageId} sent to ${phone}`);
      } else if (event === "message.received") {
        // Incoming message reply
        const { messageId, phone, message: incomingMessage } = payload;
        console.log(`[Webhook] Reply from ${phone}: ${incomingMessage}`);
        // Store reply in database for follow-up
      } else if (event === "message.ack") {
        // Delivery status change
        const { messageId, status } = payload;
        console.log(`[Webhook] Message ${messageId} status: ${status}`);
      }

      // Acknowledge receipt
      return res.status(200).json({ success: true, received: true });
    } catch (error) {
      console.error("[Webhook] Error processing Nabda webhook:", error);
      return res.status(200).json({ success: false });
    }
  });

  // Campaign bulk send with rate limiting
  app.post("/api/campaign/send", async (req, res) => {
    const { templateId, filters = {}, limit, testMode = false } = req.body;

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

      console.log(`[Campaign] Using template: "${template.name}"`);
      console.log(`[Campaign] Template content: "${template.body}"`);

      // 2. Build contact query with filters
      let contactQuery = supabaseAdmin
        .from("contact_view") // Use contact_view for consistent data
        .select("*");

      if (filters.governorate && filters.governorate !== "all") {
        contactQuery = contactQuery.eq("governorate", filters.governorate);
      }
      if (filters.category && filters.category !== "all") {
        contactQuery = contactQuery.eq("category", filters.category);
      }

      // Apply limit
      if (testMode) {
        contactQuery = contactQuery.limit(1);
        console.log("[Campaign] Test mode: fetching 1 contact");
      } else if (limit && typeof limit === "number" && limit > 0) {
        contactQuery = contactQuery.limit(limit);
        console.log(`[Campaign] Limit: ${limit} contacts`);
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
          total: 0,
          testMode
        });
      }

      console.log(`[Campaign] Fetched ${contacts.length} contact(s) for campaign`);

      // 3. Process in batches with rate limiting
      const results = await sendCampaignBatches(contacts, template.body);

      return res.json({
        success: true,
        campaignId: templateId,
        total: contacts.length,
        sent: results.sent,
        failed: results.failed,
        batches: results.batches,
        provider: "nabda",
        testMode
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
