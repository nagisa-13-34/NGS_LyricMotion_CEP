export function evalAeScript(script: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof CSInterface === 'undefined') {
      resolve(JSON.stringify({ error: 'CSInterface is not available. Open this panel inside After Effects.' }));
      return;
    }

    const cs = new CSInterface();
    cs.evalScript(script, (result) => resolve(result));
  });
}

export function escapeForExtendScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
}
