export async function generateProfessorReportSummary(complaint: any) {
  try {
    const res = await fetch("/api/gemini/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaint })
    });
    if (!res.ok) throw new Error("Server failed to generate summary");
    return await res.json();
  } catch (error) {
    console.error("Professor summary error:", error);
    throw error;
  }
}

export async function draftComplaintDescription(category: string, title: string, draftSoFar: string) {
  try {
    const res = await fetch("/api/gemini/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title, draftSoFar })
    });
    if (!res.ok) throw new Error("Server failed to generate draft");
    const data = await res.json();
    return data.text || "";
  } catch (error) {
    console.error("Automated drafting error:", error);
    throw error;
  }
}

export async function chatWithProfessor(complaint: any, messageHistory: { role: string, content: string }[], isReporting: boolean = false) {
  try {
    const res = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaint, history: messageHistory, isReporting })
    });
    if (!res.ok) throw new Error("Server failed to chat");
    const data = await res.json();
    return data.text;
  } catch (error) {
    console.error("Professor chat error:", error);
    throw error;
  }
}
