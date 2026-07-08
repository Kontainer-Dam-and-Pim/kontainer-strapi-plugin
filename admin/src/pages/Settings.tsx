import * as React from 'react';

import { Box, Button, Field, Flex, TextInput, Typography } from '@strapi/design-system';
import { Check } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';

import { getTranslation } from '../utils/getTranslation';

type Validation = { status: 'idle' | 'checking' | 'valid' } | { status: 'invalid'; reason: string };

const VALIDATION_DEBOUNCE_MS = 500;

// A strong random token to register on the Kontainer integration.
const generateToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const Settings = () => {
  const { formatMessage } = useIntl();
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [url, setUrl] = React.useState('');
  const [fileUrl, setFileUrl] = React.useState('');
  const [token, setToken] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [validation, setValidation] = React.useState<Validation>({ status: 'idle' });
  const validationSeq = React.useRef(0);

  React.useEffect(() => {
    get('/kontainer/settings')
      .then(({ data }: { data: { url: string; fileUrl: string; token: string } }) => {
        setUrl(data.url);
        setFileUrl(data.fileUrl);
        setToken(data.token);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [get]);

  // debounced live check that the URL points at an actual Kontainer instance
  React.useEffect(() => {
    if (loading) return;
    const seq = ++validationSeq.current;
    const trimmed = url.trim();
    if (!trimmed) {
      setValidation({ status: 'idle' });
      return;
    }
    setValidation({ status: 'checking' });
    const timer = setTimeout(() => {
      get('/kontainer/settings/validate', { params: { url: trimmed } })
        .then(({ data }: { data: { valid: boolean; reason?: string } }) => {
          if (seq !== validationSeq.current) return; // stale response
          setValidation(
            data.valid
              ? { status: 'valid' }
              : { status: 'invalid', reason: data.reason ?? 'invalid-url' }
          );
        })
        .catch(() => {
          if (seq !== validationSeq.current) return;
          setValidation({ status: 'invalid', reason: 'unreachable' });
        });
    }, VALIDATION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [url, loading, get]);

  const save = async () => {
    setSaving(true);
    try {
      await put('/kontainer/settings', { url: url.trim(), token: token.trim() });
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('settings.saved'),
          defaultMessage: 'Kontainer settings saved',
        }),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('settings.save-error'),
          defaultMessage: 'Could not save — enter a valid http(s) URL',
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('settings.copied'),
          defaultMessage: 'Copied to clipboard',
        }),
      });
    } catch {
      // clipboard blocked (e.g. insecure context) — user can still select manually
    }
  };

  const usageEndpoint = `${window.location.origin}/api/kontainer/file/usages`;

  const invalidMessage = (reason: string) =>
    formatMessage({
      id: getTranslation(`settings.validation.${reason}`),
      defaultMessage:
        reason === 'not-kontainer'
          ? 'This URL does not appear to be a Kontainer instance'
          : reason === 'unreachable'
            ? 'The Strapi server could not reach this URL'
            : 'Not a valid URL',
    });

  return (
    <Box padding={10}>
      <Flex direction="column" alignItems="flex-start" gap={6} maxWidth="60rem">
        <Flex direction="column" alignItems="flex-start" gap={1}>
          <Typography variant="alpha" tag="h1">
            Kontainer
          </Typography>
          <Typography variant="epsilon" textColor="neutral600">
            {formatMessage({
              id: getTranslation('settings.subtitle'),
              defaultMessage:
                'Connect Strapi to your Kontainer DAM. Editors pick files from this Kontainer in the content editor.',
            })}
          </Typography>
        </Flex>
        <Field.Root
          name="kontainer-url"
          error={validation.status === 'invalid' ? invalidMessage(validation.reason) : undefined}
          hint={
            fileUrl
              ? formatMessage(
                  {
                    id: getTranslation('settings.url.hint-fallback'),
                    defaultMessage: 'Leave empty to use the value from config/plugins: {fileUrl}',
                  },
                  { fileUrl }
                )
              : formatMessage({
                  id: getTranslation('settings.url.hint'),
                  defaultMessage: 'Example: https://yourcompany.kontainer.com',
                })
          }
          style={{ width: '100%' }}
        >
          <Field.Label>
            {formatMessage({
              id: getTranslation('settings.url.label'),
              defaultMessage: 'Kontainer URL',
            })}
          </Field.Label>
          <TextInput
            placeholder="https://yourcompany.kontainer.com"
            value={url}
            disabled={loading}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          />
          {validation.status === 'checking' && (
            <Typography variant="pi" textColor="neutral600">
              {formatMessage({
                id: getTranslation('settings.validation.checking'),
                defaultMessage: 'Checking…',
              })}
            </Typography>
          )}
          {validation.status === 'valid' && (
            <Typography variant="pi" textColor="success600">
              {formatMessage({
                id: getTranslation('settings.validation.valid'),
                defaultMessage: 'Kontainer instance detected',
              })}
            </Typography>
          )}
          <Field.Hint />
          <Field.Error />
        </Field.Root>
        <Flex direction="column" alignItems="flex-start" gap={1} width="100%">
          <Typography variant="delta" tag="h2">
            {formatMessage({
              id: getTranslation('settings.usage.title'),
              defaultMessage: 'File usage tracking',
            })}
          </Typography>
          <Typography variant="pi" textColor="neutral600">
            {formatMessage({
              id: getTranslation('settings.usage.subtitle'),
              defaultMessage:
                'To sync where files are used, register this Strapi instance in Kontainer (Settings → Integrations): copy the endpoint and token below into a new integration there.',
            })}
          </Typography>
        </Flex>
        <Field.Root
          name="kontainer-usage-endpoint"
          hint={formatMessage({
            id: getTranslation('settings.usage.endpoint.hint'),
            defaultMessage: 'Paste this as the integration endpoint in Kontainer (GET).',
          })}
          style={{ width: '100%' }}
        >
          <Field.Label>
            {formatMessage({
              id: getTranslation('settings.usage.endpoint.label'),
              defaultMessage: 'Usage endpoint URL',
            })}
          </Field.Label>
          <Flex gap={2} width="100%">
            <Box flex="1">
              <TextInput value={usageEndpoint} aria-readonly readOnly />
            </Box>
            <Button variant="tertiary" onClick={() => copy(usageEndpoint)}>
              {formatMessage({ id: getTranslation('settings.copy'), defaultMessage: 'Copy' })}
            </Button>
          </Flex>
          <Field.Hint />
        </Field.Root>
        <Field.Root
          name="kontainer-token"
          hint={formatMessage({
            id: getTranslation('settings.usage.token.hint'),
            defaultMessage:
              'Generate a token, Save, then paste it into the Kontainer integration. Without a token the endpoint is disabled.',
          })}
          style={{ width: '100%' }}
        >
          <Field.Label>
            {formatMessage({
              id: getTranslation('settings.usage.token.label'),
              defaultMessage: 'Access token',
            })}
          </Field.Label>
          <Flex gap={2} width="100%">
            <Box flex="1">
              <TextInput value={token} aria-readonly readOnly disabled={loading} />
            </Box>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setToken(generateToken())}
            >
              {formatMessage({
                id: getTranslation('settings.usage.token.generate'),
                defaultMessage: 'Generate',
              })}
            </Button>
            <Button variant="tertiary" disabled={loading || !token} onClick={() => copy(token)}>
              {formatMessage({ id: getTranslation('settings.copy'), defaultMessage: 'Copy' })}
            </Button>
          </Flex>
          <Field.Hint />
        </Field.Root>
        <Button onClick={save} loading={saving} disabled={loading} startIcon={<Check />}>
          {formatMessage({
            id: getTranslation('settings.save'),
            defaultMessage: 'Save',
          })}
        </Button>
      </Flex>
    </Box>
  );
};

export default Settings;
