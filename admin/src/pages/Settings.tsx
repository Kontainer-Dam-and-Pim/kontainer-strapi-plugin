import * as React from "react";

import { Box, Button, Field, Flex, TextInput, Typography } from "@strapi/design-system";
import { Check } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { useIntl } from "react-intl";

import { getTranslation } from "../utils/getTranslation";

const Settings = () => {
  const { formatMessage } = useIntl();
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [url, setUrl] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    get("/kontainer/settings")
      .then(({ data }: { data: { url: string; fileUrl: string } }) => {
        setUrl(data.url);
        setFileUrl(data.fileUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [get]);

  const save = async () => {
    setSaving(true);
    try {
      await put("/kontainer/settings", { url: url.trim() });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("settings.saved"),
          defaultMessage: "Kontainer settings saved",
        }),
      });
    } catch {
      toggleNotification({
        type: "danger",
        message: formatMessage({
          id: getTranslation("settings.save-error"),
          defaultMessage: "Could not save — enter a valid http(s) URL",
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box padding={10}>
      <Flex direction="column" alignItems="flex-start" gap={6} maxWidth="60rem">
        <Flex direction="column" alignItems="flex-start" gap={1}>
          <Typography variant="alpha" tag="h1">
            Kontainer
          </Typography>
          <Typography variant="epsilon" textColor="neutral600">
            {formatMessage({
              id: getTranslation("settings.subtitle"),
              defaultMessage:
                "Connect Strapi to your Kontainer DAM. Editors pick files from this Kontainer in the content editor.",
            })}
          </Typography>
        </Flex>
        <Field.Root
          name="kontainer-url"
          hint={
            fileUrl
              ? formatMessage(
                  {
                    id: getTranslation("settings.url.hint-fallback"),
                    defaultMessage:
                      "Leave empty to use the value from config/plugins: {fileUrl}",
                  },
                  { fileUrl },
                )
              : formatMessage({
                  id: getTranslation("settings.url.hint"),
                  defaultMessage: "Example: https://yourcompany.kontainer.com",
                })
          }
          style={{ width: "100%" }}
        >
          <Field.Label>
            {formatMessage({
              id: getTranslation("settings.url.label"),
              defaultMessage: "Kontainer URL",
            })}
          </Field.Label>
          <TextInput
            placeholder="https://yourcompany.kontainer.com"
            value={url}
            disabled={loading}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          />
          <Field.Hint />
        </Field.Root>
        <Button onClick={save} loading={saving} disabled={loading} startIcon={<Check />}>
          {formatMessage({
            id: getTranslation("settings.save"),
            defaultMessage: "Save",
          })}
        </Button>
      </Flex>
    </Box>
  );
};

export default Settings;
