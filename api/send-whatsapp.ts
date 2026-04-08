import type { IncomingMessage, ServerResponse } from "http";
import { sendNabdaMessage } from "./_lib.js";

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

  const { phone, message } = body as { phone?: string; message?: string };

  if (!phone || !message) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({ success: false, error: "phone and message are required" })
    );
    return;
  }

  try {
    const result = await sendNabdaMessage(phone, message);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Send failed",
      })
    );
  }
}
