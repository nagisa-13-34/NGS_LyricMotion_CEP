/// <reference types="vite/client" />

declare class CSInterface {
  evalScript(script: string, callback?: (result: string) => void): void;
}
