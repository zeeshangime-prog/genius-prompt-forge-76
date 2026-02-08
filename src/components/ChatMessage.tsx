import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, Volume2, VolumeX } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";
  const [isSpeaking, setIsSpeaking] = useState(false);

  const toggleSpeak = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const plainText = content.replace(/[#*`_~\[\]()>|-]/g, "");
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = "hi-IN";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [content, isSpeaking]);

  return (
    <div className={`flex gap-3 px-4 py-4 ${isUser ? "" : "bg-secondary/30"}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUser ? "bg-primary/20" : "gradient-primary"}`}>
        {isUser ? <User className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4 text-primary-foreground" />}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        {isUser ? (
          <p className="text-foreground text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <>
            <div className="prose prose-sm prose-invert max-w-none text-foreground">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            <button
              onClick={toggleSpeak}
              className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={isSpeaking ? "Stop" : "Listen"}
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isSpeaking ? "Stop" : "Listen"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
