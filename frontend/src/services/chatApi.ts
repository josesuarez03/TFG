import axios from "axios";
import type { ConversationDetail, ConversationSummary } from "@/types/messages";

const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || "http://localhost:5000/chat/";

const normalizeBaseUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return "http://localhost:5000/chat/";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const CHAT_API = axios.create({
  baseURL: normalizeBaseUrl(CHAT_API_URL),
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
  withCredentials: true,
});

CHAT_API.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getConversations = async (): Promise<ConversationSummary[]> => {
  const response = await CHAT_API.get("conversations");
  return response.data?.conversations || [];
};

export const getConversation = async (conversationId: string): Promise<ConversationDetail | null> => {
  const response = await CHAT_API.get(`conversation/${conversationId}`);
  return response.data?.conversation || null;
};

export const deleteConversation = async (conversationId: string): Promise<void> => {
  await CHAT_API.delete(`conversation/${conversationId}`);
};

export default CHAT_API;
