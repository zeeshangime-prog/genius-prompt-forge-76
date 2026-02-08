import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Send, Sparkles, Download, ExternalLink, RotateCcw, Copy,
  ChevronUp, ChevronDown, Terminal, Globe, Link, Check,
} from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const BUILD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/build-app`;
const SERVE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-app`;

function extractHtml(text: string): string | null {
  const match = text.match(/```html\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function generateSlug(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function AppBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [savedAppId, setSavedAppId] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText]);

  useEffect(() => {
    const html = extractHtml(streamText);
    if (html) setPreviewHtml(html);
  }, [streamText]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [buildLogs]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamText("");
    setSavedAppId(null);
    setPublishedUrl(null);
    setBuildLogs(["[BUILD] Starting app generation...", `[BUILD] Prompt: "${text.slice(0, 80)}..."`]);
    setLogsOpen(true);

    try {
      const resp = await fetch(BUILD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              fullText += c;
              setStreamText(fullText);
              setBuildLogs(prev => {
                const logs = [...prev];
                if (!logs.some(l => l.includes("Receiving"))) logs.push("[BUILD] Receiving AI response...");
                if (fullText.includes("<html") && !logs.some(l => l.includes("HTML structure"))) logs.push("[BUILD] Generating HTML structure...");
                if ((fullText.includes("<style") || fullText.includes("css")) && !logs.some(l => l.includes("Styling"))) logs.push("[BUILD] Styling components...");
                if ((fullText.includes("<script") || fullText.includes("function")) && !logs.some(l => l.includes("JavaScript"))) logs.push("[BUILD] Adding JavaScript logic...");
                return logs.length > prev.length ? logs : prev;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const json = raw.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) { fullText += c; setStreamText(fullText); }
          } catch {}
        }
      }

      const assistantMsg: Msg = { role: "assistant", content: fullText };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamText("");

      const html = extractHtml(fullText);
      if (html) {
        setPreviewHtml(html);
        setBuildLogs(p => [...p, "[BUILD] ✅ App generated successfully!", `[BUILD] Total size: ${(html.length / 1024).toFixed(1)} KB`]);
      }

    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      setBuildLogs(p => [...p, `[ERROR] ${e.message || "Build failed"}`]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const publishApp = useCallback(async () => {
    if (!previewHtml || !user) return;
    setIsPublishing(true);
    setBuildLogs(p => [...p, "[PUBLISH] Saving and publishing app..."]);

    try {
      const title = messages.find(m => m.role === "user")?.content.slice(0, 60) || "Untitled App";
      const slug = generateSlug();

      if (savedAppId) {
        // Update existing
        const { error } = await supabase
          .from("generated_apps")
          .update({ html_content: previewHtml, is_published: true, title, updated_at: new Date().toISOString() })
          .eq("id", savedAppId);
        if (error) throw error;
        setBuildLogs(p => [...p, "[PUBLISH] ✅ App updated and published!"]);
      } else {
        // Create new
        const { data, error } = await supabase
          .from("generated_apps")
          .insert({ user_id: user.id, title, slug, html_content: previewHtml, is_published: true })
          .select("id, slug")
          .single();
        if (error) throw error;
        setSavedAppId(data.id);
        setBuildLogs(p => [...p, `[PUBLISH] ✅ App published with slug: ${data.slug}`]);
      }

      const url = `${SERVE_URL}?slug=${savedAppId ? slug : slug}`;
      // Re-fetch to get actual slug
      const { data: appData } = await supabase
        .from("generated_apps")
        .select("slug")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      const publicUrl = `${SERVE_URL}?slug=${appData?.slug || slug}`;
      setPublishedUrl(publicUrl);
      setBuildLogs(p => [...p, `[PUBLISH] 🔗 Public URL: ${publicUrl}`]);
      toast.success("App published! Link is ready to share.");
    } catch (e: any) {
      toast.error(e.message || "Failed to publish");
      setBuildLogs(p => [...p, `[ERROR] Publish failed: ${e.message}`]);
    } finally {
      setIsPublishing(false);
    }
  }, [previewHtml, user, savedAppId, messages]);

  const copyPublicLink = () => {
    if (!publishedUrl) return;
    navigator.clipboard.writeText(publishedUrl);
    setLinkCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const downloadHtml = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "app.html"; a.click();
    URL.revokeObjectURL(url);
  };

  const openInNewTab = () => {
    if (publishedUrl) {
      window.open(publishedUrl, "_blank");
      return;
    }
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const copyCode = () => {
    if (!previewHtml) return;
    navigator.clipboard.writeText(previewHtml);
    toast.success("Code copied!");
  };

  const resetAll = () => {
    setPreviewHtml(null);
    setMessages([]);
    setBuildLogs([]);
    setSavedAppId(null);
    setPublishedUrl(null);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left: Chat panel */}
      <div className="w-full md:w-[400px] lg:w-[440px] flex flex-col border-r border-border shrink-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-foreground">App Builder</span>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamText && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-glow">
                <Sparkles className="w-7 h-7 text-primary-foreground" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">Describe Your App</h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                Tell me what app you want to build. I'll generate it instantly with a live preview. You can publish it too!
              </p>
              <div className="mt-6 space-y-2 w-full max-w-xs">
                {["Build a todo app with dark theme", "Create a weather dashboard", "Make a calculator app"].map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="w-full text-left px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-xs hover:text-foreground hover:bg-secondary/80 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "gradient-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {m.role === "user" ? m.content : (extractHtml(m.content) ? "✅ App generated! See preview →" : m.content.slice(0, 200))}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="bg-secondary text-foreground rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-primary" />
                <span className="text-muted-foreground">Building your app...</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 shrink-0">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the app you want to build..."
              className="min-h-[48px] max-h-32 resize-none bg-secondary border-border/60 pr-12 text-foreground placeholder:text-muted-foreground text-sm"
              rows={1}
            />
            <Button onClick={send} disabled={!input.trim() || isLoading} size="icon" className="absolute right-2 bottom-2 w-8 h-8 gradient-primary text-primary-foreground">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right: Preview + Logs */}
      <div className="hidden md:flex flex-1 flex-col min-w-0">
        {/* Preview toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
          {previewHtml && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={publishApp} disabled={isPublishing} className="text-xs gap-1 text-muted-foreground hover:text-primary">
                <Globe className="w-3.5 h-3.5" /> {isPublishing ? "Publishing..." : publishedUrl ? "Update" : "Publish"}
              </Button>
              {publishedUrl && (
                <Button variant="ghost" size="sm" onClick={copyPublicLink} className="text-xs gap-1 text-muted-foreground hover:text-primary">
                  {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                  {linkCopied ? "Copied!" : "Copy Link"}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={copyCode} className="text-xs gap-1 text-muted-foreground">
                <Copy className="w-3.5 h-3.5" /> Code
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadHtml} className="text-xs gap-1 text-muted-foreground">
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
              <Button variant="ghost" size="sm" onClick={openInNewTab} className="text-xs gap-1 text-muted-foreground">
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </Button>
              <Button variant="ghost" size="sm" onClick={resetAll} className="text-xs gap-1 text-muted-foreground">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
            </div>
          )}
        </div>

        {/* Published URL banner */}
        {publishedUrl && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-border text-xs">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">Published at:</span>
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">
              {publishedUrl}
            </a>
            <button onClick={copyPublicLink} className="text-primary hover:text-primary/80 shrink-0">
              {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* iframe */}
        <div className="flex-1 relative bg-background min-h-0">
          {previewHtml ? (
            <iframe ref={iframeRef} srcDoc={previewHtml} className="w-full h-full border-0" sandbox="allow-scripts allow-modals allow-forms allow-popups" title="App Preview" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-muted-foreground" />
                </div>
                <p>Your app preview will appear here</p>
              </div>
            </div>
          )}
        </div>

        {/* Build Logs Panel */}
        {buildLogs.length > 0 && (
          <div className="border-t border-border shrink-0">
            <button onClick={() => setLogsOpen(!logsOpen)} className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors bg-card">
              <span className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" />
                Build Logs
                {isLoading && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              </span>
              {logsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            {logsOpen && (
              <div ref={logRef} className="max-h-40 overflow-y-auto bg-background px-4 py-2 space-y-0.5 font-mono text-xs">
                {buildLogs.map((log, i) => (
                  <div key={i} className={`${log.startsWith("[ERROR]") ? "text-destructive" : log.includes("✅") || log.includes("🔗") ? "text-green-400" : "text-muted-foreground"}`}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
