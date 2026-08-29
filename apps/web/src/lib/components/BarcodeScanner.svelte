<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { IScannerControls } from '@zxing/browser';
  import { m } from '$lib/i18n/index.js';
  import { isValidBarcode, normalizeBarcode, SUPPORTED_BARCODE_FORMATS } from '$lib/nutrition/barcode.js';

  /**
   * Kamera-Barcode-Scan: primär die native `BarcodeDetector`-API, sonst
   * dynamischer Import von `@zxing/browser` als Fallback (nur bei Bedarf geladen).
   * Zusätzlich immer ein manuelles Code-Eingabefeld, da weder Kamera noch Scan-API
   * überall verfügbar sind (Permission verweigert, kein HTTPS, älterer Browser, …).
   */
  let { onDetected }: { onDetected: (code: string) => void } = $props();

  interface DetectedBarcode {
    rawValue: string;
  }
  interface BarcodeDetectorLike {
    detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
  }
  interface BarcodeDetectorConstructor {
    new (options: { formats: readonly string[] }): BarcodeDetectorLike;
  }

  let videoEl = $state<HTMLVideoElement | undefined>(undefined);
  let cameraState = $state<'starting' | 'active' | 'error'>('starting');
  let cameraErrorMessage = $state('');
  let manualCode = $state('');
  let manualError = $state<string | null>(null);

  let stream: MediaStream | null = null;
  let rafId: number | undefined;
  let scannerControls: IScannerControls | null = null;
  let stopped = false;

  function stopCamera(): void {
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
      rafId = undefined;
    }
    scannerControls?.stop();
    scannerControls = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  function handleDetected(raw: string): void {
    if (stopped) return;
    const code = normalizeBarcode(raw);
    if (!isValidBarcode(code)) return;
    stopped = true;
    stopCamera();
    onDetected(code);
  }

  async function runNativeDetectorLoop(video: HTMLVideoElement): Promise<void> {
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
      .BarcodeDetector;
    if (!Detector) return;
    const detector = new Detector({ formats: SUPPORTED_BARCODE_FORMATS });

    const tick = async (): Promise<void> => {
      if (stopped) return;
      try {
        const results = await detector.detect(video);
        const hit = results[0];
        if (hit) {
          handleDetected(hit.rawValue);
          return;
        }
      } catch {
        // Einzelne Frames können fehlschlagen (Video noch nicht bereit o.ä.) — Loop läuft weiter.
      }
      if (!stopped) rafId = requestAnimationFrame(() => void tick());
    };
    rafId = requestAnimationFrame(() => void tick());
  }

  async function runZxingFallback(video: HTMLVideoElement, mediaStream: MediaStream): Promise<void> {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    scannerControls = await reader.decodeFromStream(mediaStream, video, (result) => {
      if (result) handleDetected(result.getText());
    });
  }

  function describeCameraError(err: unknown): string {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        return m().nutrition.scanner.permissionDenied;
      }
      if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        return m().nutrition.scanner.noCamera;
      }
    }
    return m().nutrition.scanner.cameraError;
  }

  onMount(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraState = 'error';
      cameraErrorMessage = m().nutrition.scanner.unsupported;
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch (err) {
      cameraState = 'error';
      cameraErrorMessage = describeCameraError(err);
      return;
    }

    const video = videoEl;
    if (!video) {
      stopCamera();
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Manche Browser verlangen eine Nutzerinteraktion — der Stream läuft trotzdem weiter.
    }
    cameraState = 'active';

    if ('BarcodeDetector' in window) {
      await runNativeDetectorLoop(video);
    } else {
      try {
        await runZxingFallback(video, stream);
      } catch {
        cameraState = 'error';
        cameraErrorMessage = m().nutrition.scanner.unsupported;
      }
    }
  });

  onDestroy(() => {
    stopped = true;
    stopCamera();
  });

  function submitManualCode(): void {
    manualError = null;
    const code = normalizeBarcode(manualCode);
    if (!isValidBarcode(code)) {
      manualError = m().nutrition.scanner.invalidCode;
      return;
    }
    stopped = true;
    stopCamera();
    onDetected(code);
  }
</script>

<div class="scanner">
  {#if cameraState !== 'error'}
    <div class="scanner-video-wrap">
      <video bind:this={videoEl} playsinline muted aria-label={m().nutrition.scanner.starting}
      ></video>
      {#if cameraState === 'starting'}
        <p class="scanner-status">{m().nutrition.scanner.starting}</p>
      {/if}
    </div>
  {:else}
    <p class="error" role="alert">{cameraErrorMessage}</p>
  {/if}

  <div class="scanner-manual">
    <label for="manual-barcode">{m().nutrition.scanner.manualLabel}</label>
    <div class="field-row">
      <div>
        <input
          id="manual-barcode"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder={m().nutrition.scanner.manualPlaceholder}
          bind:value={manualCode}
        />
      </div>
      <button type="button" class="secondary" onclick={submitManualCode}>
        {m().nutrition.scanner.manualSubmit}
      </button>
    </div>
    {#if manualError}
      <p class="error" role="alert">{manualError}</p>
    {/if}
  </div>
</div>
