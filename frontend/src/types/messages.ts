export interface Message {
  id: string;
  content: string;
  sender: "user" | "bot" | "system";
  status?: "pending" | "sent" | "error";
  timestamp: string;
}

export interface ConversationState {
  missing_questions?: string[];
  questions_selected?: string[];
  [key: string]: unknown;
}

export interface ChatResponsePayload {
  user_message?: string;
  ai_response?: string;
  response?: string;
  timestamp?: string;
  error?: string;
  conversation_id?: string;
  triaje_level?: string;
  conversation_state?: ConversationState;
  [key: string]: unknown;
}

export interface ConversationSummary {
  _id: string;
  timestamp?: string;
  triaje_level?: string;
  symptoms?: string[];
  messages?: Array<{
    role: string;
    content: string;
  }>;
}

export interface ConversationDetail extends ConversationSummary {
  medical_context?: Record<string, unknown>;
  pain_scale?: number;
  symptoms_pattern?: Record<string, unknown> | string;
  active?: boolean;
  user_id?: string;
}
