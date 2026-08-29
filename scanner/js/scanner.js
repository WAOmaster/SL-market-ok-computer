/**
 * Camera and image decoding.
 *
 * Order of preference:
 *   1. The browser's native BarcodeDetector (Chrome/Android, Edge) - fastest and
 *      needs no download.
 *   2. ZXing, lazily pulled from a CDN, everywhere else (desktop Firefox, iOS).
 *   3. A photo from the gallery, decoded with whichever of the two is available -
 *      this is also the path used on a laptop with no camera.
 *
 * Tesseract.js is loaded on demand for reading the printed label text.
 */
(function (root, factory) {
  const api = factory();
  root.SLScan = root.SLScan || {};
  root.SLScan.scanner = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

  const state = {
    stream: null,
    video: null,
    detector: null,
    zxingReader: null,
    loopId: null,
    running: false,
    lastCode: '',
    lastAt: 0,
    engine: null
  };

  const scriptCache = {};

  function loadScript(url) {
    if (scriptCache[url]) return scriptCache[url];
    scriptCache[url] = new Promise((resolve, reject) => {
      if (typeof document === 'undefined') return reject(new Error('No document'));
      const el = document.createElement('script');
      el.src = url;
      el.async = true;
      el.onload = () => resolve(true);
      el.onerror = () => {
        delete scriptCache[url];
        reject(new Error('Could not load ' + url + ' - check the network connection.'));
      };
      document.head.appendChild(el);
    });
    return scriptCache[url];
  }

  function hasNativeDetector() {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }

  async function nativeDetector() {
    if (state.detector) return state.detector;
    let formats = FORMATS;
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      formats = FORMATS.filter(f => supported.includes(f));
      if (!formats.length) formats = supported;
    } catch (err) { /* older implementations lack getSupportedFormats */ }
    state.detector = new window.BarcodeDetector({ formats: formats });
    return state.detector;
  }

  async function zxingReader() {
    if (state.zxingReader) return state.zxingReader;
    await loadScript(ZXING_URL);
    if (!window.ZXing) throw new Error('ZXing failed to initialise.');
    const hints = new Map();
    const ZX = window.ZXing;
    try {
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
        ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A,
        ZX.BarcodeFormat.UPC_E, ZX.BarcodeFormat.CODE_128, ZX.BarcodeFormat.CODE_39,
        ZX.BarcodeFormat.ITF
      ]);
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
    } catch (err) { /* hint constants missing: fall back to defaults */ }
    state.zxingReader = new ZX.BrowserMultiFormatReader(hints, 300);
    return state.zxingReader;
  }

  function isSecureEnough() {
    if (typeof window === 'undefined') return false;
    return window.isSecureContext ||
      ['localhost', '127.0.0.1'].includes(window.location.hostname);
  }

  /**
   * Start the live camera. `onDetect(code, meta)` fires once per code; the same
   * code will not fire again inside `repeatDelay` ms so a barcode left in front
   * of the lens does not add ten lines.
   */
  async function start(options) {
    const opts = options || {};
    const video = opts.video;
    if (!video) throw new Error('A <video> element is required.');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('This browser cannot open the camera. Use "Scan a photo" instead.');
    }
    if (!isSecureEnough()) {
      throw new Error('The camera needs HTTPS (or localhost). Use "Scan a photo" instead.');
    }

    await stop();

    const constraints = {
      audio: false,
      video: {
        facingMode: opts.facingMode || { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.video = video;
    video.srcObject = state.stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    await video.play();

    const repeatDelay = opts.repeatDelay == null ? 2500 : opts.repeatDelay;
    const onDetect = opts.onDetect || function () {};
    const onError = opts.onError || function () {};

    function emit(code, meta) {
      const now = Date.now();
      if (!code) return;
      if (code === state.lastCode && now - state.lastAt < repeatDelay) return;
      state.lastCode = code;
      state.lastAt = now;
      onDetect(code, meta || {});
    }

    state.running = true;

    if (hasNativeDetector()) {
      state.engine = 'native';
      const detector = await nativeDetector();
      const tick = async () => {
        if (!state.running) return;
        try {
          const hits = await detector.detect(video);
          if (hits && hits.length) emit(hits[0].rawValue, { format: hits[0].format, engine: 'native' });
        } catch (err) {
          // Transient decode errors are normal while the frame is blurry.
        }
        state.loopId = setTimeout(tick, opts.interval || 220);
      };
      tick();
    } else {
      state.engine = 'zxing';
      const reader = await zxingReader();
      reader.decodeFromStream(state.stream, video, (result, err) => {
        if (!state.running) return;
        if (result) emit(result.getText(), { format: String(result.getBarcodeFormat()), engine: 'zxing' });
        else if (err && err.name && err.name !== 'NotFoundException' && err.name !== 'ChecksumException'
                 && err.name !== 'FormatException') onError(err);
      }).catch(onError);
    }

    return { engine: state.engine, track: state.stream.getVideoTracks()[0] || null };
  }

  async function stop() {
    state.running = false;
    if (state.loopId) { clearTimeout(state.loopId); state.loopId = null; }
    if (state.zxingReader) {
      try { state.zxingReader.reset(); } catch (err) { /* ignore */ }
    }
    if (state.stream) {
      state.stream.getTracks().forEach(t => { try { t.stop(); } catch (err) { /* ignore */ } });
      state.stream = null;
    }
    if (state.video) {
      try { state.video.srcObject = null; } catch (err) { /* ignore */ }
    }
    state.lastCode = '';
    return true;
  }

  function isRunning() { return state.running; }

  /** Phone torch, where the platform exposes it. */
  async function setTorch(on) {
    if (!state.stream) return false;
    const track = state.stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return false;
    const caps = track.getCapabilities();
    if (!caps || !caps.torch) return false;
    await track.applyConstraints({ advanced: [{ torch: !!on }] });
    return true;
  }

  async function fileToImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('That image could not be opened.'));
        img.src = url;
      });
      return { img: img, url: url };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }

  /** Decode a barcode from a photo (camera roll, screenshot, or drag-and-drop). */
  async function scanImage(file) {
    const { img, url } = await fileToImage(file);
    try {
      if (hasNativeDetector()) {
        const detector = await nativeDetector();
        const hits = await detector.detect(img);
        if (hits && hits.length) return { code: hits[0].rawValue, format: hits[0].format, engine: 'native' };
      }
      const reader = await zxingReader();
      const result = await reader.decodeFromImageUrl(url);
      return { code: result.getText(), format: String(result.getBarcodeFormat()), engine: 'zxing' };
    } catch (err) {
      throw new Error('No barcode found in that photo. Try a closer, straighter shot - or read the label text instead.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Read the printed label text out of a photo or the current camera frame. */
  async function readText(source, onProgress) {
    await loadScript(TESSERACT_URL);
    if (!window.Tesseract) throw new Error('The text reader failed to load.');
    const result = await window.Tesseract.recognize(source, 'eng', {
      logger: m => {
        if (onProgress && m && m.status === 'recognizing text') onProgress(m.progress || 0);
      }
    });
    return (result && result.data && result.data.text) || '';
  }

  /** Grab the current camera frame as a canvas, for OCR or a receipt thumbnail. */
  function captureFrame(video) {
    const el = video || state.video;
    if (!el || !el.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext('2d').drawImage(el, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  return {
    start, stop, isRunning, setTorch, scanImage, readText, captureFrame,
    hasNativeDetector, isSecureEnough, get engine() { return state.engine; }
  };
});
