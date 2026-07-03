import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

// Narrow local type for the Supabase auth.oauth beta namespace.
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauthNs = () => (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Requête d'autorisation invalide.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so /auth returns the user here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const ns = oauthNs();
    const { data, error } = approve
      ? await ns.approveAuthorization(authorizationId)
      : await ns.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Aucune redirection renvoyée par le serveur d'autorisation.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Seo title="Autoriser l'accès — FLIPZ" description="Autoriser une application à accéder à ton compte FLIPZ." path="/.lovable/oauth/consent" />
      <div className="w-full max-w-sm rounded-2xl border border-primary/20 bg-card p-6 shadow-xl">
        {error ? (
          <>
            <h1 className="text-lg font-display font-bold text-destructive mb-2">Erreur</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </>
        ) : !details ? (
          <p className="text-sm text-muted-foreground text-center">Chargement…</p>
        ) : (
          <>
            <h1 className="text-xl font-display font-bold text-foreground mb-2">
              Autoriser {details.client?.name ?? "cette application"} ?
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              L'application demande à lire ta collection, ton streak et ton profil FLIPZ en ton nom.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                Refuser
              </Button>
              <Button variant="gold" className="flex-1" disabled={busy} onClick={() => decide(true)}>
                Autoriser
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
