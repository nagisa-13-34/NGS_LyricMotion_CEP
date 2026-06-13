import { useState, useRef, useEffect } from 'react';
import { CurveEditor } from './components/CurveEditor';
import { escapeForExtendScript, evalAeScript } from './lib/cep';
import type { MotionSettings } from './lib/types';
import './styles.css';

const defaultSettings: MotionSettings = {
  moveX: 0,
  moveY: 200,
  moveZ: 0,
  inDur: 8,
  outDur: 8,
  stagger: 3,
  useOut: true,
  useSameOut: true,
  outX: 0,
  outY: -200,
  outZ: 0,
  useOpacity: true,
  opIn: 0,
  opOut: 0,
  useScale: false,
  scIn: 0,
  scOut: 0,
  useRotation: false,
  rotIn: 0,
  rotOut: 0,
  randomAxis: false,
  randomDirection: 1,
  staggerReverse: true,
  inCurve: { p1: { x: 0.42, y: 0 }, p2: { x: 0.58, y: 1 } },
  outCurve: { p1: { x: 0.42, y: 0 }, p2: { x: 0.58, y: 1 } },
};

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function NumberInput({
  label,
  value,
  onChange,
  width = 'small',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  width?: 'small' | 'wide';
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // 外部から値が変わったら同期（フォーカス中は除外）
  if (!focused && text !== String(value)) {
    setText(String(value));
  }

  const commit = () => {
    const n = Number(text);
    if (!Number.isNaN(n)) onChange(n);
    else setText(String(value));
    setFocused(false);
  };

  return (
    <label className={`number-field ${width}`}>
      <span>{label}</span>
      <input
        value={focused ? text : value}
        onChange={(e) => { setText(e.target.value); }}
        onFocus={() => { setFocused(true); setText(String(value)); }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
    </label>
  );
}

const PRESETS_KEY = 'ngs_lyricmotion_presets';

function loadPresets(): Record<string, MotionSettings> {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function savePresets(presets: Record<string, MotionSettings>) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export default function App() {
  const [settings, setSettings] = useState<MotionSettings>(defaultSettings);
  const [status, setStatus] = useState('準備完了');
  const [presets, setPresets] = useState(loadPresets);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [applying, setApplying] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof MotionSettings>(key: K, value: MotionSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleLoadPreset = (name: string) => {
    setSelectedPreset(name);
    if (name && presets[name]) {
      setSettings({ ...defaultSettings, ...presets[name] });
    }
  };

  const handleSavePreset = () => {
    const name = prompt('プリセット名を入力');
    if (!name || !name.trim()) return;
    const next = { ...presets, [name.trim()]: { ...settings } };
    setPresets(next);
    savePresets(next);
    setSelectedPreset(name.trim());
    setStatus(`プリセット「${name.trim()}」を保存しました`);
  };

  const handleDeletePreset = () => {
    if (!selectedPreset) return;
    const next = { ...presets };
    delete next[selectedPreset];
    setPresets(next);
    savePresets(next);
    setStatus(`プリセット「${selectedPreset}」を削除しました`);
    setSelectedPreset('');
  };

  const applyMotion = async () => {
    setApplying(true);
    setStatus('適用中...');
    const payload = escapeForExtendScript(JSON.stringify(settings));
    const result = await evalAeScript(`NGS_LyricMotion_apply('${payload}')`);

    setApplying(false);
    try {
      const data = JSON.parse(result);
      if (data.error) {
        setErrorModal(data.error);
        setStatus('エラー');
      } else {
        setStatus(`${data.count} レイヤーに適用しました`);
      }
    } catch {
      const msg = result || 'After Effectsから応答がありません';
      setErrorModal(msg);
      setStatus('エラー');
    }
  };

  const presetNames = Object.keys(presets);

  return (
    <main className="app-shell">

      <div className="preset-bar">
        <select
          className="preset-select"
          value={selectedPreset}
          onChange={(e) => handleLoadPreset(e.target.value)}
        >
          <option value="">プリセット</option>
          {presetNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button className="preset-btn save" onClick={handleSavePreset} title="保存">保存</button>
        <button
          className="preset-btn danger"
          onClick={handleDeletePreset}
          disabled={!selectedPreset}
          title="削除"
        >×</button>
      </div>

      <section className="motion-grid">
        <div className="panel-block">
          <h2>イン モーション</h2>
          <div className="field-row">
            <NumberInput label="X" value={settings.moveX} onChange={(value) => update('moveX', value)} />
            <NumberInput label="Y" value={settings.moveY} onChange={(value) => update('moveY', value)} />
            <NumberInput label="Z" value={settings.moveZ} onChange={(value) => update('moveZ', value)} />
          </div>
          <div className="field-row">
            <NumberInput label="フレーム" value={settings.inDur} onChange={(value) => update('inDur', value)} />
            <NumberInput label="ずらし" value={settings.stagger} onChange={(value) => update('stagger', value)} />
          </div>
          <div className="field-row">
            <label className="switch-row">
              <input
                type="checkbox"
                checked={settings.staggerReverse}
                onChange={(event) => update('staggerReverse', event.target.checked)}
              />
              <span>下から</span>
            </label>
            <label className="switch-row inline-switch">
              <span>方向:</span>
              <select
                className="app-select"
                value={settings.randomDirection ?? (settings.randomAxis ? 2 : 1)}
                onChange={(e) => update('randomDirection', Number(e.target.value))}
              >
                <option value={1}>1方向</option>
                <option value={2}>2方向</option>
                <option value={4}>4方向</option>
              </select>
            </label>
          </div>
          <CurveEditor label="イン カーブ" curve={settings.inCurve} onChange={(curve) => update('inCurve', curve)} />
        </div>

        <div className="panel-block">
          <div className="section-title-row">
            <h2>アウト モーション</h2>
            <div className="switch-group">
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={settings.useOut}
                  onChange={(event) => update('useOut', event.target.checked)}
                />
                <span>有効</span>
              </label>
              {settings.useOut && (
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={settings.useSameOut}
                    onChange={(event) => update('useSameOut', event.target.checked)}
                  />
                  <span>IN反転</span>
                </label>
              )}
            </div>
          </div>
          {settings.useOut && (
            <>
              {!settings.useSameOut && (
                <>
                  <div className="field-row">
                    <NumberInput label="X" value={settings.outX} onChange={(value) => update('outX', value)} />
                    <NumberInput label="Y" value={settings.outY} onChange={(value) => update('outY', value)} />
                    <NumberInput label="Z" value={settings.outZ} onChange={(value) => update('outZ', value)} />
                  </div>
                  <div className="field-row">
                    <NumberInput label="フレーム" value={settings.outDur} onChange={(value) => update('outDur', value)} />
                  </div>
                </>
              )}
              <CurveEditor label="アウト カーブ" curve={settings.outCurve} onChange={(curve) => update('outCurve', curve)} />
            </>
          )}
        </div>

        <div className="panel-block compact">
          <h2>レイヤー設定</h2>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.useOpacity}
              onChange={(event) => update('useOpacity', event.target.checked)}
            />
            <span>不透明度</span>
          </label>
          <div className="field-row">
            <NumberInput label="イン %" value={settings.opIn} onChange={(value) => update('opIn', value)} />
            <NumberInput label="アウト %" value={settings.opOut} onChange={(value) => update('opOut', value)} />
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.useScale}
              onChange={(event) => update('useScale', event.target.checked)}
            />
            <span>スケール</span>
          </label>
          <div className="field-row">
            <NumberInput label="イン %" value={settings.scIn} onChange={(value) => update('scIn', value)} />
            <NumberInput label="アウト %" value={settings.scOut} onChange={(value) => update('scOut', value)} />
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.useRotation}
              onChange={(event) => update('useRotation', event.target.checked)}
            />
            <span>回転</span>
          </label>
          <div className="field-row">
            <NumberInput label="イン °" value={settings.rotIn} onChange={(value) => update('rotIn', value)} />
            <NumberInput label="アウト °" value={settings.rotOut} onChange={(value) => update('rotOut', value)} />
          </div>
        </div>
      </section>

      <footer className="status-bar">
        {applying ? (
          <div className="progress-track">
            <div ref={progressRef} className="progress-fill" />
          </div>
        ) : (
          <span>{status}</span>
        )}
        <button className="apply-btn" onClick={applyMotion} disabled={applying}>適用</button>
      </footer>

      {errorModal && (
        <div className="error-modal-overlay" onPointerDown={() => setErrorModal(null)}>
          <div className="error-modal" onPointerDown={(e) => e.stopPropagation()}>
            <div className="error-modal-header">
              <span>⚠ エラー</span>
            </div>
            <div className="error-modal-body">
              <p>{errorModal}</p>
            </div>
            <div className="error-modal-footer">
              <button type="button" className="curve-btn confirm" onClick={() => setErrorModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
