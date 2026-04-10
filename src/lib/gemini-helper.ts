// AI features are currently disabled
// To enable: npm install @google/genai and add VITE_GEMINI_API_KEY to .env
export const gemini = null;

/**
 * Generate an AI-powered FAQ response for business inquiries
 * Helps answer common questions about the platform and services
 */
export async function generateFAQResponse(
  businessName: string,
  category: string,
  governorate: string,
  userQuestion: string
): Promise<string> {
  if (!gemini) {
    return "I'm unable to respond right now. Please contact support.";
  }

  try {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are a helpful business assistant for a WhatsApp business directory platform.

A business has asked a question:

Business Name: ${businessName}
Category: ${category}
Location: ${governorate}

Customer Question: "${userQuestion}"

Please provide a helpful, professional, and concise response (2-3 sentences max) in Arabic that:
1. Acknowledges their question
2. Addresses their concern
3. Suggests a next step or provides the information they need

Keep the tone friendly but professional. Avoid overly casual language.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating FAQ response:", error);
    return "Thank you for your question. We'll get back to you soon.";
  }
}

/**
 * Generate an intelligent follow-up message if a customer hasn't replied
 */
export async function generateFollowUpMessage(
  businessName: string,
  category: string,
  originalMessage: string
): Promise<string> {
  if (!gemini) {
    return `Hi ${businessName}, just checking in about our previous message.`;
  }

  try {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Generate a professional, friendly follow-up message in Arabic for a business.

Original message sent: "${originalMessage}"
Business Name: ${businessName}
Business Category: ${category}

Create a brief follow-up message (1-2 sentences) that:
1. Reminds them of the original message
2. Shows genuine interest
3. Invites them to engage

The message should be in Arabic, professional, and persuasive without being pushy.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating follow-up message:", error);
    return `شكراً لك، نأمل الرد على رسالتنا السابقة.`; // "Thank you, we hope to hear your response to our previous message"
  }
}

/**
 * Analyze sentiment of incoming messages to classify engagement
 */
export async function analyzeSentiment(
  message: string
): Promise<{ sentiment: "positive" | "neutral" | "negative"; confidence: number }> {
  if (!gemini) {
    return { sentiment: "neutral", confidence: 0 };
  }

  try {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze the sentiment of this message in one word (positive, neutral, or negative) and provide a confidence score (0-1).

Message: "${message}"

Respond in JSON format only: {"sentiment": "positive"|"neutral"|"negative", "confidence": 0.0}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse the JSON response
    const parsed = JSON.parse(response);
    return {
      sentiment: parsed.sentiment || "neutral",
      confidence: parsed.confidence || 0
    };
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return { sentiment: "neutral", confidence: 0 };
  }
}
