import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "AIzaSyBJ0ZtoZ7NjzvSx-W2qTy_rFbWWbVDm9As" });
const app = express();

app.use(express.json());

// --- Gemini API Endpoints ---
app.post("/api/gemini/summary", async (req, res) => {
  const { complaint } = req.body;
  const prompt = `You are a distinguished and empathetic University Professor specializing in Student Affairs. 
  Analyse this student report and provide a mentor-style summary.
  
  Report Title: ${complaint.title}
  Category: ${complaint.category}
  Priority: ${complaint.priority}
  Status: ${complaint.status}
  Description: ${complaint.description}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are Professor Aethelgard. You respond only in JSON. Your tone is academic, wise, and highly supportive.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Your academic assessment of the issue (2 sentences)" },
            status_note: { type: Type.STRING, description: "A reassuring note about the next steps (1 sentence)" },
            tip: { type: Type.STRING, description: "A practical 'office hours' style tip for the student" },
            eta: { type: Type.STRING, description: "The anticipated resolution timeline" }
          },
          required: ["summary", "status_note", "tip", "eta"]
        }
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error) {
    console.error("Server summary error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

app.post("/api/gemini/draft", async (req, res) => {
  const { category, title, draftSoFar } = req.body;
  const prompt = `Help a university student write a clear, professional complaint description. 
  Category: ${category}
  Title: ${title}
  Draft so far: "${draftSoFar}"
  
  Write a 3-4 sentence professional complaint description in first person. Be specific about the impact on studies. Return only the description text, nothing else.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a helpful faculty support advisor.",
      },
    });
    res.json({ text: response.text?.trim() || "" });
  } catch (error) {
    console.error("Server drafting error:", error);
    res.status(500).json({ error: "Failed to generate draft" });
  }
});

app.post("/api/gemini/chat", async (req, res) => {
  const { history, isReporting, complaint } = req.body;
  try {
    const systemPrompt = isReporting 
      ? "You are Professor Aethelgard, a wise and empathetic faculty mentor. A student is currently drafting a report. You MUST keep your responses to exactly 2 or 3 sentences. Be direct but kind. Always ask something like 'What specific problem are you facing, my dear student?' or 'How can I assist with your current concern?' to keep them focused."
      : `You are Professor Aethelgard. You are discussing a filed report: "${complaint?.title}". You MUST keep your responses to exactly 2 or 3 sentences. Always be supportive and give practical advice related to university policy. End your responses by asking if there's any other detail they wish to clarify.`;

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: systemPrompt,
      },
      history: history.slice(0, -1).map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      })),
    });

    const lastMessage = history[history.length - 1];
    const result = await chat.sendMessage({
      message: lastMessage.content
    });
    res.json({ text: result.text });
  } catch (error) {
    console.error("Server chat error:", error);
    res.status(500).json({ error: "Failed to chat" });
  }
});

// --- Mock API Data ---
let complaints = [
  {
    id: "CMP-2024-0041",
    title: "Incorrect grade recorded for CS301 final exam",
    category: "academic",
    priority: "high",
    status: "in_review",
    date: "Apr 18, 2026",
    updated: "Apr 21, 2026",
    description: "My final exam for CS301 shows 54/100 but I clearly scored higher. I have photos of my answer sheet and I believe there was a marking error on question 5 and 8.",
    timeline: [
      { date: "Apr 18", event: "Complaint submitted", type: "submit" },
      { date: "Apr 19", event: "Assigned to Academic Affairs department", type: "assign" },
      { date: "Apr 21", event: "Under review — examiner contacted", type: "update" },
    ],
    smartSummary: "The student is disputing their CS301 grade due to potential marking errors on specific questions. Academic Affairs is investigating.",
    smartTip: "Keep your photos of the answer sheet ready in case of a formal hearing.",
    smartEta: "3-5 business days",
    smartNext: "Examiner will verify the marks against the marking scheme."
  },
  {
    id: "CMP-2024-0038",
    title: "Library Wi-Fi disconnects every 20 minutes",
    category: "tech",
    priority: "medium",
    status: "resolved",
    date: "Apr 10, 2026",
    updated: "Apr 17, 2026",
    description: "The library Wi-Fi has been dropping every 20 minutes which makes it impossible to do online research or submit assignments on time.",
    timeline: [
      { date: "Apr 10", event: "Complaint submitted", type: "submit" },
      { date: "Apr 12", event: "IT department notified", type: "assign" },
      { date: "Apr 14", event: "Router replaced in study zone B", type: "update" },
      { date: "Apr 17", event: "Issue resolved — connectivity restored", type: "resolve" },
    ],
    smartSummary: "Recurring infrastructure issue affecting library connectivity. Resolved by hardware replacement.",
    smartTip: "Report connectivity issues as soon as they persist more than a few hours.",
    smartEta: "Resolved",
    smartNext: "Problem has been closed."
  }
];

// --- API Routes ---
app.get("/api/complaints", (req, res) => {
  res.json(complaints);
});

app.post("/api/complaints", (req, res) => {
  const newComplaint = {
    ...req.body,
    id: `CMP-2024-00${50 + complaints.length}`,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    timeline: [{ date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), event: "Complaint submitted", type: "submit" }]
  };
  complaints = [newComplaint, ...complaints];
  res.status(201).json(newComplaint);
});

app.patch("/api/complaints/:id", (req, res) => {
  const { id } = req.params;
  const update = req.body;
  complaints = complaints.map(c => c.id === id ? { ...c, ...update, updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } : c);
  const updated = complaints.find(c => c.id === id);
  res.json(updated);
});

async function startServer() {
  const PORT = 3000;

  // --- Vite Middleware ---
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

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer();
}

export default app;
