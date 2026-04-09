import { sendCampaignBatches, personalizeMessage } from "../_lib";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const body = await req.json();
  const { templateId, filters = {}, limit, testMode = false } = body;

  if (!templateId) {
    return new Response(JSON.stringify({ error: "templateId is required" }), { status: 400 });
  }

  try {
    const { data: template, error: templateError } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 });
    }

    console.log(`[Campaign] Using template: "${template.name}"`);
    console.log(`[Campaign] Template content: "${template.body}"`);

    let contactQuery = supabaseAdmin
      .from("contact_view")
      .select("*")
      .eq("validity_status", "valid")
      .eq("ready_to_send", true);

    if (filters.governorate && filters.governorate !== "all") {
      contactQuery = contactQuery.eq("governorate", filters.governorate);
    }
    if (filters.category && filters.category !== "all") {
      contactQuery = contactQuery.eq("category", filters.category);
    }

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
      return new Response(JSON.stringify({
        success: true,
        message: "No contacts match the filters",
        sent: 0,
        failed: 0,
        total: 0,
        testMode
      }), { status: 200 });
    }

    console.log(`[Campaign] Fetched ${contacts.length} contact(s) for campaign`);

    const results = await sendCampaignBatches(contacts, template.body);

    return new Response(JSON.stringify({
      success: true,
      campaignId: templateId,
      total: contacts.length,
      sent: results.sent,
      failed: results.failed,
      batches: results.batches,
      provider: "nabda",
      testMode
    }), { status: 200 });

  } catch (error) {
    console.error("[Campaign] Failed:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Campaign failed"
    }), { status: 500 });
  }
}
