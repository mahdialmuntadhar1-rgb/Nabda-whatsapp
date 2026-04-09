import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const NABDA_API_URL = process.env.NABDA_API_URL || "https://api.nabdaotp.com/inst/84cf1e71-6f8d-4411-9e58-de6a18e6007c";
const NABDA_INSTANCE_ID = process.env.NABDA_INSTANCE_ID || "84cf1e71-6f8d-4411-9e58-de6a18e6007c";
const NABDA_API_TOKEN = process.env.NABDA_API_TOKEN || "";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;

function personalizeMessage(template: string, contact: any): string {
  let message = template;
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

async function sendNabdaMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; provider: string }> {
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

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
    }

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
    console.error(`[Nabda] FAILED phone=${phone} error=${errorMsg}`);
    throw new Error(`Failed to send via Nabda: ${errorMsg}`);
  }
}

async function logSendResult(
  contactId: string,
  phone: string,
  message: string,
  status: "sent" | "failed",
  errorMessage?: string,
  messageId?: string
): Promise<void> {
  try {
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

    const batchPromises = batch.map(async (contact) => {
      let phone: string | undefined;
      try {
        phone = contact.phone || contact.whatsapp_phone;
        if (!phone) {
          throw new Error("No phone number available");
        }

        const personalizedMessage = personalizeMessage(messageTemplate, contact);
        const result = await sendNabdaMessage(phone, personalizedMessage);

        await logSendResult(
          contact.id,
          phone,
          personalizedMessage,
          "sent",
          undefined,
          result.messageId
        );

        sent++;
        console.log(`[Sent] ${contact.name || contact.id} (${contact.governorate}/${contact.category}) → ${phone}`);
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        const personalizedMessage = personalizeMessage(messageTemplate, contact);

        await logSendResult(
          contact.id,
          phone || "",
          personalizedMessage,
          "failed",
          errorMsg
        );

        console.error(`[Failed] ${contact.name || contact.id}: ${errorMsg}`);
      }
    });

    await Promise.all(batchPromises);

    if (batchIndex < totalBatches - 1) {
      console.log(`[Campaign] Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  console.log(`[Campaign] Complete! Sent: ${sent}, Failed: ${failed}`);
  return { sent, failed, batches: totalBatches };
}

export { sendNabdaMessage, logSendResult, sendCampaignBatches, personalizeMessage };
