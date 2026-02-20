export interface Message {
  id: string;
  content: string;
  sender: "user" | "bot" | "system";
  status?: "pending" | "sent" | "error";
  timestamp: string;
}
