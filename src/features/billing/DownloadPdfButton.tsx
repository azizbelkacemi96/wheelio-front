/**
 * Authenticated PDF download button (BILL-05). Calls downloadPdf, which streams
 * the bytes through the ky client (Bearer auth) and triggers a browser
 * download from an in-memory blob — never a bare link that would leak the
 * token. Surfaces its own pending + error state inline.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { downloadPdf } from "./api";

export function DownloadPdfButton({
  path,
  filename,
  label,
  variant = "outline",
}: {
  path: string;
  filename: string;
  label: string;
  variant?: "default" | "outline";
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const onClick = async () => {
    setPending(true);
    setFailed(false);
    try {
      await downloadPdf(path, filename);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant={variant} disabled={pending} onClick={onClick}>
        <Download className="size-4" aria-hidden={true} />
        {label}
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          {t("billing.errors.downloadFailed")}
        </span>
      )}
    </div>
  );
}
