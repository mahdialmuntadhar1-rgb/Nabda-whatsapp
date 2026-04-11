import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock Nabda / WhatsApp API endpoint
  app.post("/api/send-whatsapp", async (req, res) => {
    const { phone, message, apiKey } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate success/failure
    const success = Math.random() > 0.1; // 90% success rate

    /* 
    REAL INTEGRATION EXAMPLE (Nabda):
    try {
      const response = await fetch("https://api.nabda.com/v1/send", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NABDA_API_KEY}`
        },
        body: JSON.stringify({ to: phone, text: message })
      });
      const result = await response.json();
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
    */

    if (success) {
      console.log(`[WhatsApp] Sent to ${phone}: ${message.substring(0, 30)}...`);
      return res.json({
        success: true,
        messageId: `msg_${Math.random().toString(36).substring(7)}`,
        provider: "nabda_mock",
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error(`[WhatsApp] Failed to send to ${phone}`);
      return res.status(500).json({
        success: false,
        error: "Provider connection timeout",
        provider: "nabda_mock",
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
