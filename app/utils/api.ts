export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function sendChatMessage(messages: Message[]) {
  console.log("Sending chat message:", messages);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sending chat message:", error);
    throw error;
  }
}
