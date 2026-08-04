/**
 * Vehicle documents + photos card (Phase 8). Upload a recognition photo or a
 * legal paper (carte grise / assurance / contrôle technique) with an optional
 * expiry; the list shows image thumbnails, an expiry badge (expired / soon),
 * and download + delete actions.
 *
 * Image previews and downloads use the short-lived SIGNED URL (download-url) so
 * the browser can render/fetch them directly without an Authorization header.
 * Gated by `canOperate` on the vehicle's agency (write actions); the backend
 * re-enforces.
 */
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useLocale } from "@/shared/i18n/useLocale";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldLabel } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { DOCUMENT_TYPES, type DocumentResponse } from "@/types/document";
import { getDocumentDownloadURL } from "./api";
import { useVehicleDocumentsQuery } from "./queries";
import { useDeleteDocument, useUploadDocument } from "./mutations";

interface UploadFormValues {
  type: DocumentResponse["type"];
  title: string;
  issued_at: string;
  expires_at: string;
}

function isImage(doc: DocumentResponse): boolean {
  return doc.content_type.startsWith("image/");
}

/** expiry classification for a YYYY-MM-DD date vs today. */
function expiryTone(expiresAt?: string): "expired" | "soon" | "ok" | null {
  if (!expiresAt) return null;
  const now = new Date();
  const exp = new Date(`${expiresAt}T00:00:00`);
  const days = Math.floor((exp.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}

export function VehicleDocuments({
  vehicleId,
  canWrite,
}: {
  vehicleId: string;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const docsQuery = useVehicleDocumentsQuery(vehicleId);
  const docs = docsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("documents.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canWrite && <UploadForm vehicleId={vehicleId} />}

        {docsQuery.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : docsQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("documents.loadError")}
          </p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("documents.empty")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {docs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                vehicleId={vehicleId}
                canWrite={canWrite}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UploadForm({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const mutation = useUploadDocument(vehicleId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  const { control, register, handleSubmit, reset } = useForm<UploadFormValues>({
    defaultValues: { type: "other", title: "", issued_at: "", expires_at: "" },
  });

  const submit = handleSubmit((values) => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    mutation.mutate(
      {
        file,
        type: values.type,
        title: values.title || undefined,
        issuedAt: values.issued_at || undefined,
        expiresAt: values.expires_at || undefined,
      },
      {
        onSuccess: () => {
          reset({ type: "other", title: "", issued_at: "", expires_at: "" });
          if (fileRef.current) fileRef.current.value = "";
          setFileName("");
        },
      },
    );
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="doc-type">{t("documents.type")}</FieldLabel>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="doc-type" className="w-full" aria-label={t("documents.type")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {t(`documents.docType.${dt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="doc-title">{t("documents.docTitle")}</FieldLabel>
          <Input id="doc-title" {...register("title")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="doc-issued">{t("documents.issuedAt")}</FieldLabel>
          <Input id="doc-issued" type="date" {...register("issued_at")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="doc-expires">{t("documents.expiresAt")}</FieldLabel>
          <Input id="doc-expires" type="date" {...register("expires_at")} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" aria-hidden={true} />
          {t("documents.chooseFile")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          aria-label={t("documents.chooseFile")}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
        {fileName && <span className="truncate text-sm text-muted-foreground">{fileName}</span>}
        <Button type="submit" size="sm" disabled={mutation.isPending || !fileName} className="ml-auto">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden={true} />}
          {t("documents.upload")}
        </Button>
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("documents.uploadError")}
        </p>
      )}
    </form>
  );
}

function DocumentRow({
  doc,
  vehicleId,
  canWrite,
}: {
  doc: DocumentResponse;
  vehicleId: string;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const deleteMutation = useDeleteDocument(vehicleId);
  const tone = expiryTone(doc.expires_at);

  const openDownload = async () => {
    const signed = await getDocumentDownloadURL(doc.id);
    window.open(signed.url, "_blank", "noopener");
  };

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      {isImage(doc) ? (
        <DocumentThumbnail documentId={doc.id} alt={doc.title} />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-muted">
          <FileText className="size-8 text-muted-foreground" aria-hidden={true} />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground" title={doc.title}>
            {doc.title || t(`documents.docType.${doc.type}`)}
          </span>
          <span className="text-xs text-muted-foreground">{t(`documents.docType.${doc.type}`)}</span>
          {doc.expires_at && (
            <Badge
              variant={tone === "expired" ? "destructive" : tone === "soon" ? "outline" : "secondary"}
              className="mt-1 w-fit"
            >
              {tone === "expired"
                ? t("documents.expired")
                : t("documents.expiresOn", {
                    date: new Date(`${doc.expires_at}T00:00:00`).toLocaleDateString(locale),
                  })}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => void openDownload()}>
            {t("documents.download")}
          </Button>
          {canWrite && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t("documents.delete")}
              onClick={() => deleteMutation.mutate(doc.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="size-4" aria-hidden={true} />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Lazily fetches the signed URL for an image document and renders it. */
function DocumentThumbnail({ documentId, alt }: { documentId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getDocumentDownloadURL(documentId)
      .then((s) => active && setUrl(s.url))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [documentId]);

  if (failed) {
    return <div className="aspect-[4/3] w-full rounded-md bg-muted" />;
  }
  if (!url) {
    return <Skeleton className="aspect-[4/3] w-full rounded-md" />;
  }
  return (
    <img src={url} alt={alt} className="aspect-[4/3] w-full rounded-md object-cover" />
  );
}
