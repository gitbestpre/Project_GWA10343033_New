/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 语音合成的同源路由（默认 /api/tts）。只允许改路径，不得在此放任何凭据。 */
  readonly VITE_TTS_PATH?: string
}
