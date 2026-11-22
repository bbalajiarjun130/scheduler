import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    async function handleCredential(resp: { credential: string }) {
      setError(null);
      try {
        await api.post("/auth/google", { credential: resp.credential });
        await refetch();
        navigate("/");
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : "Google sign-in failed");
      }
    }

    function render() {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({ client_id: clientId!, callback: handleCredential });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    }

    if (window.google) {
      render();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!clientId) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex w-full items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div ref={containerRef} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
