// Shared logic for Vercel serverless functions
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const NABDA_API_URL =
  process.env.NABDA_API_URL ||
  "https://api.nabdaotp.com/inst/84cf1e71-6f8d-4411-9e58-de6a18e6007c";
const NABDA_INSTANCE_ID =
  process.env.NABDA_INSTANCE_ID || "84cf1e71-6f8d-4411-9e58-de6a18e6007c";
const NABDA_API_TOKEN =
  process.env.NABDA_API_TOKEN || "sk_40e90a8b16fa4265a8f54ea3cc96b87d";

export async function sendNabdaMessage(
  phone: string,
  message: string,
  variables?: string[]
): Promise<{ success: boolean; messageId?: string; provider: string }> {
  const formattedPhone = phone.replace(/^\+/, "");
  const payload: Record<string, unknown> = { phone: formattedPhone, message };
  if (variables && variables.length > 0) payload.variables = variables;

  let response: Response;
  try {
    response = await fetch(`${NABDA_API_URL}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NABDA_API_TOKEN}`,
        "X-Instance-ID": NABDA_INSTANCE_ID,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    throw new Error(
      `Network error reaching Nabda API: ${networkError instanceof Error ? networkError.message : String(networkError)}`
    );
  }

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `Nabda API error: ${response.status} - ${rawBody.slice(0, 200)}`
    );
  }

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(rawBody);
  } catch {
    console.warn("[Nabda] Non-JSON response:", rawBody.slice(0, 200));
  }

  return {
    success: true,
    messageId: (data.messageId || data.id) as string | undefined,
    provider: "nabda",
  };
}

export function personalizeMessage(
  template: string,
  contact: Record<string, unknown>
): { message: string; variables: string[] } {
  const name = String(contact.display_name || contact.name || "");
  const governorate = String(contact.governorate || "");
  const category = String(contact.category || "");
  const variables = [name, governorate];
  const message = template
    .replace(/\{\{1\}\}/g, name)
    .replace(/\{\{2\}\}/g, governorate)
    .replace(/\{\{3\}\}/g, category)
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{governorate\}\}/gi, governorate)
    .replace(/\{\{category\}\}/gi, category);
  return { message, variables };
}

export async function logSendResult(
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
        message,
        status,
        error: errorMessage || null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (msgError) {
      console.error("[Log] Failed to insert message:", msgError);
      return;
    }

    const { error: logError } = await supabaseAdmin.from("send_logs").insert({
      message_id: messageRecord.id,
      provider: "nabda",
      status,
      response: { messageId, phone, error: errorMessage },
    });

    if (logError) console.error("[Log] Failed to insert send_log:", logError);
  } catch (err) {
    console.error("[Log] Failed to log send result:", err);
  }
}

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;

export async function sendCampaignBatches(
  contacts: Record<string, unknown>[],
  messageTemplate: string
): Promise<{ sent: number; failed: number; batches: number }> {
  let sent = 0;
  let failed = 0;
  const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batch = contacts.slice(
      batchIndex * BATCH_SIZE,
      (batchIndex + 1) * BATCH_SIZE
    );

    await Promise.all(
      batch.map(async (contact) => {
        const phone = String(
          contact.whatsapp_phone || contact.normalized_phone || ""
        );
        if (!phone) {
          failed++;
          return;
        }
        const { message, variables } = personalizeMessage(
          messageTemplate,
          contact
        );
        try {
          const result = await sendNabdaMessage(phone, message, variables);
          await logSendResult(
            String(contact.id),
            String(contact.normalized_phone || ""),
            message,
            "sent",
            undefined,
            result.messageId
          );
          sent++;
        } catch (error) {
          failed++;
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          await logSendResult(
            String(contact.id),
            String(contact.normalized_phone || ""),
            message,
            "failed",
            errorMsg
          );
        }
      })
    );

    if (batchIndex < totalBatches - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return { sent, failed, batches: totalBatches };
}
