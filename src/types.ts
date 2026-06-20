export interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  personaId: string;
  createdAt: string;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  description: string;
  systemInstruction: string;
  emoji: string;
}
