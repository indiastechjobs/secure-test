import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies
app.use(express.json());

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Chat API Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], systemInstruction } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message must be a non-empty string" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API Key is not configured. Please add GEMINI_API_KEY to your secrets.",
      });
    }

    // Map history to Google GenAI structure
    // history array elements are expected to have: { role: 'user' | 'model', content: string }
    const contents = history.map((item: any) => ({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: item.content }],
    }));

    // Append the current user request
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    console.log(`Sending prompt to Gemini with systemInstruction: "${systemInstruction || ""}"`);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction || "You are a helpful, professional, and friendly AI chatbot.",
        temperature: 0.7,
      },
    });

    const reply = response.text || "No response received from the model.";

    res.json({
      reply: reply,
    });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({
      error: error.message || "An error occurred while communicating with the Gemini API.",
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Started server in development mode (with Vite middleware)");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
  }

  // Fallback for SPA routing in production
  app.get("*", (req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
      next();
    } else {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Let's resolve the minor typo before startServer
startServer();
