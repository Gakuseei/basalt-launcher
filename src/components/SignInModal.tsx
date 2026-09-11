import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, Copy, ExternalLink, Link, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "./ui";
import { Modal, ModalHeader } from "./Modal";
import { useStore } from "../store";

export function SignInModal() {
  const auth = useStore((s) => s.auth);
  const resetAuth = useStore((s) => s.resetAuth);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const open = auth.status !== "idle";

  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? auth.userCode : auth.verificationUri;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Modal open={open} onClose={resetAuth} labelledBy="sign-in-title">
      <ModalHeader id="sign-in-title" title="Sign in with Microsoft" onClose={resetAuth} />

      {auth.status === "starting" && (
        <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-content-muted">
          <Loader2 className="size-4 animate-spin" />
          Starting sign-in
        </div>
      )}

      {auth.status === "error" && (
        <div className="px-5 py-6 text-center">
          <TriangleAlert className="mx-auto size-6 text-danger" />
          <div className="mt-2 font-display font-semibold text-content">Sign-in failed</div>
          <p className="mt-1 wrap-break-word text-sm text-content-muted">{auth.message}</p>
          <Button variant="ghost" className="mt-5" onClick={resetAuth}>
            Close
          </Button>
        </div>
      )}

      {auth.status === "pending" && (
        <div className="px-5 py-6">
          <p className="text-sm text-content-muted">
            Open the sign-in page and enter this code to link your account.
          </p>

          <button
            onClick={() => copy("code")}
            title="Copy the code"
            className="group mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-void px-5 py-4 transition-colors hover:border-(--accent)"
          >
            <span className="font-mono text-2xl font-bold tracking-[0.25em] text-content">
              {auth.userCode}
            </span>
            {copied === "code" ? (
              <Check className="size-4 text-ok" />
            ) : (
              <Copy className="size-4 text-content-faint group-hover:text-content" />
            )}
          </button>

          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => auth.verificationUri && openUrl(auth.verificationUri)}
            >
              <ExternalLink className="size-4" />
              Open sign-in page
            </Button>
            <Button variant="ghost" onClick={() => copy("link")}>
              {copied === "link" ? (
                <Check className="size-4 text-ok" />
              ) : (
                <Link className="size-4" />
              )}
              {copied === "link" ? "Copied" : "Copy link"}
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-content-faint">
            <Loader2 className="size-3 animate-spin" />
            Waiting for you to finish in the browser
          </div>
        </div>
      )}
    </Modal>
  );
}
