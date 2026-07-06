import * as React from "react";

import { Box, Button, Field, Flex, Typography } from "@strapi/design-system";
import { useFetchClient } from "@strapi/strapi/admin";
import { useIntl } from "react-intl";

import { getTranslation } from "../utils/getTranslation";

// Payload posted by the Kontainer picker (?cmsMode=1). One object per file,
// an array when multiple files are selected. Extra keys (cf, video, focal
// point, ...) are kept verbatim — the whole payload is stored as JSON.
interface KontainerFile {
  fileId?: number | string;
  fileName?: string;
  url?: string;
  thumbnailUrl?: string;
  alt?: string;
  description?: string;
  type?: string;
  extension?: string;
  [key: string]: unknown;
}

type PickerPayload = KontainerFile | KontainerFile[];

interface InputProps {
  name: string;
  value?: string | PickerPayload | null;
  onChange: (event: {
    target: { name: string; value: string | null; type: string };
  }) => void;
  error?: string;
  hint?: React.ReactNode;
  label?: React.ReactNode;
  labelAction?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}

const PICKER_WINDOW_FEATURES =
  "location=yes,height=800,width=1200,scrollbars=yes,status=yes";

const toFiles = (value: InputProps["value"]): KontainerFile[] => {
  let parsed: PickerPayload | null = null;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  } else if (value && typeof value === "object") {
    parsed = value;
  }
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
};

const KontainerMediaInput = React.forwardRef<HTMLButtonElement, InputProps>(
  (
    { name, value, onChange, error, hint, label, labelAction, required, disabled },
    ref,
  ) => {
    const { formatMessage } = useIntl();
    const { get } = useFetchClient();
    // null = loading, '' = not configured
    const [kontainerUrl, setKontainerUrl] = React.useState<string | null>(null);
    const messageHandler = React.useRef<((e: MessageEvent) => void) | null>(null);

    React.useEffect(() => {
      let mounted = true;
      get("/kontainer/config")
        .then(({ data }: { data: { url?: string } }) => {
          if (mounted) setKontainerUrl((data.url ?? "").replace(/\/+$/, ""));
        })
        .catch(() => {
          if (mounted) setKontainerUrl("");
        });
      return () => {
        mounted = false;
        if (messageHandler.current) {
          window.removeEventListener("message", messageHandler.current);
        }
      };
    }, [get]);

    const files = toFiles(value);

    const openPicker = () => {
      if (!kontainerUrl) return;
      if (messageHandler.current) {
        window.removeEventListener("message", messageHandler.current);
      }
      const picker = window.open(
        `${kontainerUrl}/?cmsMode=1`,
        "kontainer-picker",
        PICKER_WINDOW_FEATURES,
      );
      const handler = (event: MessageEvent) => {
        if (event.origin !== new URL(kontainerUrl).origin) return;
        let data: unknown = event.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data || typeof data !== "object") return;
        window.removeEventListener("message", handler);
        messageHandler.current = null;
        onChange({
          target: { name, value: JSON.stringify(data), type: "json" },
        });
        picker?.close();
      };
      messageHandler.current = handler;
      window.addEventListener("message", handler);
    };

    const clear = () => {
      onChange({ target: { name, value: null, type: "json" } });
    };

    const notConfigured = kontainerUrl === "";

    return (
      <Field.Root name={name} error={error} hint={hint} required={required}>
        <Field.Label action={labelAction}>{label}</Field.Label>
        {files.length > 0 && (
          <Flex gap={4} paddingTop={2} paddingBottom={2} wrap="wrap">
            {files.map((file, index) => (
              <Flex key={`${file.fileId ?? index}`} gap={3} alignItems="center">
                {(file.thumbnailUrl || file.type === "image") && (
                  <img
                    src={file.thumbnailUrl || file.url}
                    alt={file.alt || file.fileName || ""}
                    style={{ height: "6.4rem", borderRadius: "4px" }}
                  />
                )}
                <Flex direction="column" alignItems="flex-start" gap={1}>
                  <Typography fontWeight="semiBold" textColor="neutral800">
                    {file.fileName ?? String(file.fileId ?? "")}
                  </Typography>
                  {file.alt ? (
                    <Typography variant="pi" textColor="neutral600">
                      {file.alt}
                    </Typography>
                  ) : null}
                </Flex>
              </Flex>
            ))}
          </Flex>
        )}
        <Flex gap={2} paddingTop={files.length ? 0 : 1}>
          <Button
            ref={ref}
            onClick={openPicker}
            disabled={disabled || !kontainerUrl}
            variant="secondary"
          >
            {formatMessage(
              files.length
                ? {
                    id: getTranslation("input.replace"),
                    defaultMessage: "Replace",
                  }
                : {
                    id: getTranslation("input.choose"),
                    defaultMessage: "Choose from Kontainer",
                  },
            )}
          </Button>
          {files.length > 0 && (
            <Button onClick={clear} disabled={disabled} variant="danger-light">
              {formatMessage({
                id: getTranslation("input.remove"),
                defaultMessage: "Remove",
              })}
            </Button>
          )}
        </Flex>
        {notConfigured && (
          <Typography variant="pi" textColor="danger600">
            {formatMessage({
              id: getTranslation("input.not-configured"),
              defaultMessage:
                "Kontainer URL is not configured. Set it under Settings → Kontainer.",
            })}
          </Typography>
        )}
        <Field.Hint />
        <Field.Error />
      </Field.Root>
    );
  },
);

KontainerMediaInput.displayName = "KontainerMediaInput";

// customFields.register types Input as a plain ComponentType
export default KontainerMediaInput as unknown as React.ComponentType;
