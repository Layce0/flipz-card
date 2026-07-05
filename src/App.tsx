import { lazy, Suspense } from "react";
const OnboardingTutorial = lazy(() => import("@/components/OnboardingTutorial").then(m => ({ default: m.OnboardingTutorial })));
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Seo } from "@/components/Seo";
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
import OAuthConsent from "./pages/OAuthConsent";
import StreakRestored from "./pages/StreakRestored";

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

const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  "/": {
    title: "FLIPZ — Cartes Mystères à collectionner",
    description: "Découvrez une nouvelle carte mystère toutes les 12 heures et bâtissez votre collection légendaire sur FLIPZ.",
  },
  "/collection": {
    title: "Ma Collection — FLIPZ",
    description: "Parcourez vos cartes par rareté et complétez votre collection FLIPZ.",
  },
  "/packs": {
    title: "Boosters & Packs — FLIPZ",
    description: "Ouvrez des boosters gratuits et premium pour révéler de nouvelles cartes mystères.",
  },
  "/shop": {
    title: "Boutique FLIPZ — Packs & échanges",
    description: "Achetez des packs, échangez vos doublons et utilisez vos codes promo dans la boutique FLIPZ.",
  },
  "/profile": {
    title: "Profil joueur — FLIPZ",
    description: "Vos statistiques, votre winstreak et vos paramètres de compte FLIPZ.",
  },
  "/auth": {
    title: "Connexion — FLIPZ",
    description: "Connectez-vous ou créez un compte FLIPZ pour commencer votre collection.",
  },
  "/reset-password": {
    title: "Réinitialiser le mot de passe — FLIPZ",
    description: "Définissez un nouveau mot de passe pour votre compte FLIPZ.",
  },
};

const RouteSeo = () => {
  const { pathname } = useLocation();
  const meta = ROUTE_SEO[pathname] ?? ROUTE_SEO["/"];
  return <Seo title={meta.title} description={meta.description} path={pathname} />;
};

import { SplashScreen } from "@/components/SplashScreen";
import { useAuth } from "@/contexts/AuthContext";

const AppContent = () => {
  const { updateRequired, storeUrl } = useForceUpdate();
  const { isLoading: isAuthLoading } = useAuth();

  return (
    <div className="relative min-h-screen pt-[env(safe-area-inset-top,24px)]">
      <SplashScreen isAuthReady={!isAuthLoading} />
      <RouteSeo />
      {/* Black Top Banner for Safe Area */}
      <div 
        className="fixed top-0 left-0 right-0 bg-[#0a0a0a] z-[100]" 
        style={{ height: 'env(safe-area-inset-top, 24px)' }} 
      />
      <ForceUpdateDialog open={updateRequired} storeUrl={storeUrl} />
      <ParticlesBackground />
      <ActiveBoostsOverlay />
      <Suspense fallback={null}><OnboardingTutorial /></Suspense>
      <GlobalGifsOverlay />
      <GiftRevealPopup />
      <main>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/packs" element={<Packs />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
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
