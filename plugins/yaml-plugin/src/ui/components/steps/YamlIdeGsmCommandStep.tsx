import type { NodeId } from '@hierarchidb/core-types';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import {
  YAML_COMMAND_CAPABILITIES,
  YAML_SUBTYPE_REGISTRY,
  type YamlCanonicalFilename,
  type YamlCommandId,
  type YamlSubtype,
} from '@hierarchidb/yaml-api';
import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import PlayArrow from '@mui/icons-material/PlayArrow';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { type FC, useId, useMemo, useState } from 'react';
import type { YamlDraft } from '../../../common/types/yamlEntityTypes.js';
import type {
  YamlIdeGsmExecutionStatus,
  YamlIdeGsmExecutorLike,
  YamlIdeGsmStep4Runtime,
} from './YamlIdeGsmCommandStepTypes.js';

type RuntimeInput = Readonly<Record<string, unknown>>;

export interface YamlIdeGsmCommandStepProps extends PluginStepProps<YamlDraft> {
  readonly step4Runtime: YamlIdeGsmStep4Runtime;
}

const ERROR_LABELS: Readonly<Record<string, string>> = Object.freeze({
  FEATURE_DISABLED: 'Feature disabled',
  INVALID_INPUT: 'Invalid input',
  CANONICAL_VALIDATION_FAILED: 'Invalid YAML payload',
  UNAUTHORIZED_COMMAND: 'Command is not allowed for this subtype',
  DUPLICATE_COMMAND: 'Command is already running',
  CREDENTIALS_UNAVAILABLE: 'Credentials unavailable',
  YAML_SYNC_FAILED: 'YAML sync failed',
  COMMAND_FAILED: 'Command failed',
});

const ACTIVE_STATUSES = new Set(['REGISTERED', 'READY', 'LEASED']);

function isYamlSubtype(value: unknown): value is YamlSubtype {
  return typeof value === 'string' && value in YAML_SUBTYPE_REGISTRY;
}

function resolveCanonicalFilename(data: YamlDraft): YamlCanonicalFilename | null {
  if (!isYamlSubtype(data.subtype)) return null;
  const expected = YAML_SUBTYPE_REGISTRY[data.subtype].fileName;
  return data.name === expected ? expected : null;
}

function resolveValidation(
  data: YamlDraft
): { ok: true; filename: YamlCanonicalFilename } | { ok: false; message: string } {
  if (!isYamlSubtype(data.subtype)) return { ok: false, message: 'Missing YAML subtype.' };
  const filename = resolveCanonicalFilename(data);
  if (filename === null) {
    return { ok: false, message: 'Filename does not match the selected subtype.' };
  }
  const validation = validateYamlCanonicalPayload(filename, {
    subtype: data.subtype,
    schemaId: data.schemaId,
    content: data.content,
  });
  if (!validation.ok) {
    return { ok: false, message: 'YAML content does not match the canonical contract.' };
  }
  return { ok: true, filename };
}

function buildRuntimeInput(
  commandId: YamlCommandId,
  projectRelativePath: string,
  connectionType: string
): RuntimeInput {
  if (commandId === 'rsync-push' || commandId === 'rsync-pull') {
    return Object.freeze({ projectRelativePath, connectionType });
  }
  return Object.freeze({ projectRelativePath });
}

function formatStatus(status: YamlIdeGsmExecutionStatus | null): string {
  if (status === null) return '';
  return `${status.phase}: ${status.task.status}`;
}

function errorLabel(code: string): string {
  return ERROR_LABELS[code] ?? 'Command failed';
}

export const YamlIdeGsmCommandStep: FC<YamlIdeGsmCommandStepProps> = ({
  data,
  parentId,
  disabled,
  step4Runtime,
}) => {
  const commandLabelId = useId();
  const connectionLabelId = useId();
  const subtype = isYamlSubtype(data.subtype) ? data.subtype : null;
  const commands = useMemo(
    () => (subtype === null ? [] : [...YAML_COMMAND_CAPABILITIES[subtype]]),
    [subtype]
  );
  const [selectedCommand, setSelectedCommand] = useState<YamlCommandId | ''>(
    () => commands[0]?.commandId ?? ''
  );
  const [projectRelativePath, setProjectRelativePath] = useState(
    step4Runtime.defaultProjectRelativePath ?? ''
  );
  const [connectionType, setConnectionType] = useState<'remote' | 'ssh' | 'ec2'>('remote');
  const [runningCommand, setRunningCommand] = useState<YamlCommandId | null>(null);
  const [status, setStatus] = useState<YamlIdeGsmExecutionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validation = resolveValidation(data);
  const commandId =
    commands.find((capability) => capability.commandId === selectedCommand)?.commandId ??
    commands[0]?.commandId ??
    '';
  const requiresConnectionType = commandId === 'rsync-push' || commandId === 'rsync-pull';
  const canRun =
    !disabled &&
    step4Runtime.enabled &&
    step4Runtime.executor !== undefined &&
    validation.ok &&
    parentId !== undefined &&
    commandId !== '' &&
    projectRelativePath.length > 0 &&
    runningCommand === null;

  const runCommand = async (executor: YamlIdeGsmExecutorLike, filename: YamlCanonicalFilename) => {
    if (commandId === '' || parentId === undefined || subtype === null) return;
    const activeCommand = commandId;
    setRunningCommand(activeCommand);
    setStatus(null);
    setError(null);
    setSuccess(null);
    const result = await executor.execute(
      {
        parentId: parentId as NodeId,
        filename,
        payload: {
          subtype,
          schemaId: data.schemaId,
          content: data.content,
        },
        commandId: activeCommand,
        runtimeInput: buildRuntimeInput(activeCommand, projectRelativePath, connectionType),
      },
      (nextStatus) => {
        setStatus(nextStatus);
      }
    );
    if (result.ok) {
      setSuccess(result.commandTaskId);
    } else {
      setError(errorLabel(result.code));
    }
    setRunningCommand(null);
  };

  if (subtype === null) {
    return <Alert severity="error">Missing YAML subtype.</Alert>;
  }

  if (commands.length === 0) {
    return (
      <Alert severity="info">
        No commands are available for {YAML_SUBTYPE_REGISTRY[subtype].displayName}.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      {validation.ok ? null : <Alert severity="error">{validation.message}</Alert>}
      {step4Runtime.executor === undefined ? (
        <Alert severity="warning">IDE-GSM executor is not available.</Alert>
      ) : null}
      {parentId === undefined ? (
        <Alert severity="error">Parent node id is required to run IDE-GSM commands.</Alert>
      ) : null}
      <FormControl fullWidth size="small">
        <InputLabel id={commandLabelId}>Command</InputLabel>
        <Select
          labelId={commandLabelId}
          label="Command"
          value={commandId}
          disabled={disabled || runningCommand !== null}
          onChange={(event) => setSelectedCommand(event.target.value as YamlCommandId)}
        >
          {commands.map((capability) => (
            <MenuItem key={capability.commandId} value={capability.commandId}>
              {capability.commandId}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="Project path"
        size="small"
        value={projectRelativePath}
        disabled={disabled || runningCommand !== null}
        onChange={(event) => setProjectRelativePath(event.target.value)}
        required
        fullWidth
      />
      {requiresConnectionType ? (
        <FormControl fullWidth size="small">
          <InputLabel id={connectionLabelId}>Connection</InputLabel>
          <Select
            labelId={connectionLabelId}
            label="Connection"
            value={connectionType}
            disabled={disabled || runningCommand !== null}
            onChange={(event) => setConnectionType(event.target.value as 'remote' | 'ssh' | 'ec2')}
          >
            <MenuItem value="remote">remote</MenuItem>
            <MenuItem value="ssh">ssh</MenuItem>
            <MenuItem value="ec2">ec2</MenuItem>
          </Select>
        </FormControl>
      ) : null}
      <Box>
        <Button
          variant="contained"
          startIcon={runningCommand === null ? <PlayArrow /> : <CircularProgress size={16} />}
          disabled={!canRun}
          onClick={() => {
            if (!validation.ok || step4Runtime.executor === undefined) return;
            void runCommand(step4Runtime.executor, validation.filename);
          }}
        >
          Run
        </Button>
      </Box>
      {status === null ? null : (
        <Typography
          variant="body2"
          color={ACTIVE_STATUSES.has(status.task.status) ? 'text.secondary' : 'text.primary'}
        >
          {formatStatus(status)}
        </Typography>
      )}
      {success === null ? null : <Alert severity="success">Command task {success} finished.</Alert>}
      {error === null ? null : <Alert severity="error">{error}</Alert>}
    </Stack>
  );
};
