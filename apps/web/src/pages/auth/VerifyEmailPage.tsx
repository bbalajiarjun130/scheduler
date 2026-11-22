import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { api, ApiRequestError } from "@/lib/apiClient";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }
    api
      .post("/auth/verify-email", { token })
      .then(() => setState("success"))
      .catch((err) => {
        setState("error");
        setMessage(err instanceof ApiRequestError ? err.message : "Verification failed");
      });
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      {state === "loading" && <p className="text-center text-sm text-muted-foreground">Verifying...</p>}
      {state === "success" && (
        <p className="text-center text-sm text-muted-foreground">
          Your email is verified.{" "}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </p>
      )}
      {state === "error" && <p className="text-center text-sm text-red-600">{message}</p>}
    </AuthLayout>
  );
}
