import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessage } from "@/components/ChatMessage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { streamChat, type Msg } from "@/lib/chat-stream";
import { supabase } from "@/integrations/supabase/client";
import {
  Code, Cpu, MessageSquare, BookOpen, Send, Plus, LogOut, Sparkles, Menu, X,
} from "lucide-react";

type ChatMode = "chat" | "code" | "app" | "scanner";

const MODES: { id: ChatMode; label: string; icon: typeof Code; desc: string }[] = [
  { id: "code", label: "Code Genie", icon: Code, desc: "Generate code" },
  { id: "app", label: "App Builder", icon: Cpu, desc: "Build apps" },
  { id: "chat", label: "AI Chat", icon: MessageSquare, desc: "Chat" },
  { id: "scanner", label: "Book Scanner", icon: BookOpen, desc: "Scan books" },
];

export function ChatDashboard() {
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<{ id: string; title: string; mode: string }[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id, title, mode")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setConversations(data);
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveConvoId(null);
    setInput("");
  };

  const loadConversation = async (convoId: string) => {
    setActiveConvoId(convoId);
    const convo = conversations.find((c) => c.id === convoId);
    if (convo) setMode(convo.mode as ChatMode);
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Msg[]);
    setSidebarOpen(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    let convoId = activeConvoId;

    try {
      // Create conversation if new
      if (!convoId) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ user_id: user!.id, title: text.slice(0, 60), mode })
          .select("id")
          .single();
        if (error) throw error;
        convoId = data.id;
        setActiveConvoId(convoId);
      }

      // Save user message
      await supabase.from("messages").insert({
        conversation_id: convoId,
        user_id: user!.id,
        role: "user",
        content: text,
      });

      let assistantSoFar = "";
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      await streamChat({
        messages: [...messages, userMsg],
        mode,
        onDelta: upsertAssistant,
        onDone: async () => {
          setIsLoading(false);
          // Save assistant message
          if (assistantSoFar && convoId) {
            await supabase.from("messages").insert({
              conversation_id: convoId,
              user_id: user!.id,
              role: "assistant",
              content: assistantSoFar,
            });
          }
          loadConversations();
        },
      });
    } catch (e: any) {
      setIsLoading(false);
      toast.error(e.message || "Something went wrong");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const currentMode = MODES.find((m) => m.id === mode)!;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative z-40 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-4 border-b border-border">
          <Button onClick={startNewChat} className="w-full gradient-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => loadConversation(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${c.id === activeConvoId ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              {c.title}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-foreground">NexusAI</span>
          </div>
          <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
            <currentMode.icon className="w-3.5 h-3.5" />
            {currentMode.label}
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-6 shadow-glow">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">How can I help you?</h2>
              <p className="text-muted-foreground text-sm max-w-md">
                Choose a mode below and start typing. I can generate code, build apps, chat, or scan books.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3 px-4 py-4 bg-secondary/30">
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary-foreground animate-pulse-glow" />
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${currentMode.label}...`}
                className="min-h-[52px] max-h-40 resize-none bg-secondary border-border/60 pr-12 text-foreground placeholder:text-muted-foreground"
                rows={1}
              />
              <Button
                onClick={send}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="absolute right-2 bottom-2 w-8 h-8 gradient-primary text-primary-foreground"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Mode buttons */}
            <div className="flex gap-2 justify-center flex-wrap">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === m.id
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  <m.icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
