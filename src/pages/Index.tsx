import { useAuth } from "@/hooks/useAuth";
import { LandingPage } from "@/components/LandingPage";
import { ChatDashboard } from "@/components/ChatDashboard";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-lg gradient-primary animate-pulse-glow" />
      </div>
    );
  }

  return user ? <ChatDashboard /> : <LandingPage />;
};

export default Index;
