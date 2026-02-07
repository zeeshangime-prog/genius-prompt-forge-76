import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/AuthModal";
import { Sparkles, Code, Cpu, MessageSquare, BookOpen } from "lucide-react";

export function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute inset-0 gradient-glow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">NexusAI</span>
        </div>
        <Button
          onClick={() => setAuthOpen(true)}
          variant="outline"
          className="border-border/60 text-foreground hover:bg-secondary"
        >
          Sign In
        </Button>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-secondary/50 mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Next Generation AI Assistant</span>
        </div>

        <h1 className="font-display text-5xl sm:text-7xl font-bold text-foreground mb-6 animate-fade-in leading-tight" style={{ animationDelay: "0.1s" }}>
          Supercharge your{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            workflow
          </span>{" "}
          with AI
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          Experience the future of productivity. Generate code, build apps, and
          analyze documents with our advanced AI models.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <Button
            onClick={() => setAuthOpen(true)}
            size="lg"
            className="gradient-primary text-primary-foreground font-semibold px-8 h-13 text-base shadow-glow"
          >
            Get Started Free →
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-border/60 text-foreground hover:bg-secondary px-8 h-13 text-base"
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
          >
            View Features
          </Button>
        </div>

        {/* Features grid */}
        <div id="features" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-24 w-full">
          {[
            { icon: Code, title: "Code Genie", desc: "Generate scripts in any language" },
            { icon: Cpu, title: "App Builder", desc: "Design & build applications" },
            { icon: MessageSquare, title: "AI Chat", desc: "Intelligent conversation" },
            { icon: BookOpen, title: "Book Scanner", desc: "Extract exam questions" },
          ].map((f, i) => (
            <div
              key={f.title}
              className="glass rounded-xl p-6 text-left hover:border-primary/30 transition-all duration-300 animate-fade-in cursor-default"
              style={{ animationDelay: `${0.4 + i * 0.1}s` }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
