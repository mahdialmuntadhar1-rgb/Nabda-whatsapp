import type { IncomingMessage, ServerResponse } from "http";
import { supabaseAdmin, sendCampaignBatches } from "../_lib.js";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, error: "Method not allowed" }));
    return;
  }

  let body: Record<string, unknown> = {};
  try {
    const raw = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
    body = JSON.parse(raw);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
    return;
  }

  const {
    templateId,
    filters = {},
    limit,
    testMode = false,
  } = body as {
    templateId?: string;
    filters?: { governorate?: string; category?: string };
    limit?: number;
    testMode?: boolean;
  };

  if (!templateId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: "templateId is required" }));
    return;
  }

  try {
    // 1. Fetch template
    const { data: template, error: templateError } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, error: "Template not found" }));
      return;
    }

    // 2. Build contact query
    let contactQuery = supabaseAdmin
      .from("contacts")
      .select("*")
      .eq("validity_status", "valid")
      .eq("ready_to_send", true);

    if (filters?.governorate)
      contactQuery = contactQuery.eq("governorate", filters.governorate);
    if (filters?.category)
      contactQuery = contactQuery.eq("category", filters.category);
    if (testMode) {
      contactQuery = contactQuery.limit(1);
    } else if (limit && typeof limit === "number") {
      contactQuery = contactQuery.limit(limit);
    }

    const { data: contacts, error: contactsError } = await contactQuery;

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: "No contacts match the filters",
          sent: 0,
          failed: 0,
          total: 0,
        })
      );
      return;
    }

    // 3. Send in batches
    const results = await sendCampaignBatches(contacts, template.content);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        campaignId: templateId,
        total: contacts.length,
        sent: results.sent,
        failed: results.failed,
        batches: results.batches,
        provider: "nabda",
      })
    );
  } catch (error) {
    console.error("[Campaign] Failed:", error);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Campaign failed",
      })
    );
  }
}
