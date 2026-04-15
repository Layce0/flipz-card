import { lazy, Suspense } from "react";
const OnboardingTutorial = lazy(() => import("@/components/OnboardingTutorial").then(m => ({ default: m.OnboardingTutorial })));
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminRoute } from "@/components/AdminRoute";
import { ParticlesBackground } from "@/components/ParticlesBackground";
import { ActiveBoostsOverlay } from "@/components/ActiveBoostsOverlay";
import { GlobalGifsOverlay } from "@/components/GlobalGifsOverlay";
import { GiftRevealPopup } from "@/components/GiftRevealPopup";
import { ForceUpdateDialog } from "@/components/ForceUpdateDialog";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import Index from "./pages/Index";
import Collection from "./pages/Collection";
import Packs from "./pages/Packs";
import Shop from "./pages/Shop";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — avoid refetching on every mount
      gcTime: 10 * 60 * 1000,   // 10 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppContent = () => {
  const { updateRequired, storeUrl } = useForceUpdate();

  return (
    <div className="relative min-h-screen">
      <ForceUpdateDialog open={updateRequired} storeUrl={storeUrl} />
      <ParticlesBackground />
      <ActiveBoostsOverlay />
      <Suspense fallback={null}><OnboardingTutorial /></Suspense>
      <GlobalGifsOverlay />
      <GiftRevealPopup />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/packs" element={<Packs />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
