import type { MotionSettings } from './types';
import { escapeForExtendScript, evalAeScript } from './cep';

export type PresetMap = Record<string, MotionSettings>;

type PresetStoreResponse = {
  ok: boolean;
  exists?: boolean;
  path?: string;
  presets?: PresetMap;
  error?: string;
};

const LEGACY_PRESETS_KEY = 'ngs_lyricmotion_presets';

function parseResponse(raw: string): PresetStoreResponse {
  let response: PresetStoreResponse;
  try {
    response = JSON.parse(raw) as PresetStoreResponse;
  } catch {
    throw new Error(raw || 'After Effectsからプリセットの応答がありません');
  }

  if (!response.ok) {
    throw new Error(response.error || 'プリセット操作に失敗しました');
  }
  return response;
}

async function mutatePresets(payload: object): Promise<PresetStoreResponse> {
  const escaped = escapeForExtendScript(JSON.stringify(payload));
  const raw = await evalAeScript(`NGS_LyricMotion_mutatePresets('${escaped}')`);
  return parseResponse(raw);
}

function readLegacyPresets(): PresetMap {
  try {
    const raw = localStorage.getItem(LEGACY_PRESETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as PresetMap : {};
  } catch {
    return {};
  }
}

export async function initializePresets(): Promise<PresetMap> {
  const shared = parseResponse(await evalAeScript('NGS_LyricMotion_loadPresets()'));
  const legacy = readLegacyPresets();
  if (Object.keys(legacy).length === 0 && shared.exists) return shared.presets || {};

  const migrated = await mutatePresets({ action: 'migrate', presets: legacy });
  if (Object.keys(legacy).length > 0) localStorage.removeItem(LEGACY_PRESETS_KEY);
  return migrated.presets || {};
}

export async function upsertPreset(
  name: string,
  settings: MotionSettings,
): Promise<PresetMap> {
  const response = await mutatePresets({ action: 'upsert', name, settings });
  return response.presets || {};
}

export async function deletePreset(name: string): Promise<PresetMap> {
  const response = await mutatePresets({ action: 'delete', name });
  return response.presets || {};
}
