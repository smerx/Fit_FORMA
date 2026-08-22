/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface BarcodeDetector {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetector
  getSupportedFormats?: () => Promise<string[]>
}

interface Window {
  BarcodeDetector?: BarcodeDetectorConstructor
}
