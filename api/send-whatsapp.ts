import { sendNabdaMessage } from "./_lib";

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const body = await req.json();
  const { phone, message } = body;

  if (!phone || !message) {
    return new Response(JSON.stringify({ error: "Phone and message are required" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const result = await sendNabdaMessage(phone, message);
    return new Response(JSON.stringify(result), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Nabda] Send failed:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "nabda"
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
