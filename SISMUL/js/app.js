/**
 * app.js
 * Sistem Multimedia - Kelompok 2
 * Koordinator & Integrasi Aplikasi Web Image Editor
 * - Manajemen State & Canvas
 * - Undo / Redo History Stack
 * - Binding UI Komponen (Transformasi, Warna, Inspektor, Kompresi, Keamanan, Metrik)
 * - Pratinjau Bandingkan (Before / After Split Slider)
 * - Ekspor & Pengukuran PSNR Real-Time
 */

(function () {
  'use strict';

  // State Utama Aplikasi
  const state = {
    originalImage: null,       // Citra referensi asli (HTMLImageElement)
    originalFileData: null,    // { name, size, type, buffer }
    currentCanvas: null,       // Canvas elemen aktif
    currentCtx: null,          // 2D context
    historyStack: [],          // Undo stack: Array<{ width, height, data: Uint8ClampedArray, name: string }>
    redoStack: [],             // Redo stack
    maxHistory: 20,
    zoom: 1.0,                 // Skala tampilan kanvas
    panX: 0,                   // Offset geser horizontal (Move/Pan)
    panY: 0,                   // Offset geser vertikal (Move/Pan)
    activeTool: 'pan',         // 'pan' | 'zoom' | 'loupe'
    isComparing: false,        // Mode perbandingan Before/After aktif
    compareSplit: 0.5,         // Posisi split slider (0..1)
    cropState: {
      active: false,
      aspect: 'free',
      x: 50,
      y: 50,
      w: 200,
      h: 200,
      isDragging: false,
      dragHandle: null,
      startX: 0,
      startY: 0
    },
    subsamplingMode: '4:4:4',
    lastProcessingTime: 0,
    histMode: 'all',
  };

  // Referensi Elemen DOM
  const dom = {};

  function initDOMReferences() {
    // Top Nav
    dom.fileInput = document.getElementById('file-input');
    dom.btnOpenFile = document.getElementById('btn-open-file');
    dom.btnSampleDropdown = document.getElementById('btn-sample-dropdown');
    dom.btnCamera = document.getElementById('btn-camera');
    dom.sampleMenu = document.getElementById('sample-menu');
    dom.btnUndo = document.getElementById('btn-undo');
    dom.btnRedo = document.getElementById('btn-redo');
    dom.btnReset = document.getElementById('btn-reset');
    dom.btnCompareToggle = document.getElementById('btn-compare-toggle');
    dom.btnExportQuick = document.getElementById('btn-export-quick');
    dom.btnTeamInfo = document.getElementById('btn-team-info');
    dom.btnNavClear = document.getElementById('btn-nav-clear');

    // Canvas Viewport
    dom.viewport = document.getElementById('viewport');
    dom.emptyState = document.getElementById('empty-state');
    dom.canvasWrapper = document.getElementById('canvas-wrapper');
    dom.btnEmptyChoose = document.getElementById('btn-empty-choose');
    dom.btnEmptyCamera = document.getElementById('btn-empty-camera');
    dom.btnLoadSampleQuick = document.getElementById('btn-load-sample-quick');
    dom.btnChangeImage = document.getElementById('btn-change-image');
    dom.emptyDropzone = document.getElementById('empty-dropzone');
    dom.btnClearImage = document.getElementById('btn-clear-image');
    dom.globalDragOverlay = document.getElementById('global-drag-overlay');
    dom.cameraModal = document.getElementById('camera-modal');
    dom.cameraVideo = document.getElementById('camera-video');
    dom.cameraStatus = document.getElementById('camera-status');
    dom.btnCapturePhoto = document.getElementById('btn-capture-photo');
    dom.btnCancelCamera = document.getElementById('btn-cancel-camera');
    dom.btnCloseCamera = document.getElementById('btn-close-camera');
    dom.mainCanvas = document.getElementById('main-canvas');
    dom.cropOverlay = document.getElementById('crop-overlay');
    dom.cropBox = document.getElementById('crop-box');
    dom.compareContainer = document.getElementById('compare-container');
    dom.compareCanvas = document.getElementById('compare-canvas');
    dom.compareHandle = document.getElementById('compare-handle');

    // Zoom Controls
    dom.viewportControls = document.getElementById('viewport-controls');
    dom.btnZoomIn = document.getElementById('btn-zoom-in');
    dom.btnZoomOut = document.getElementById('btn-zoom-out');
    dom.btnZoomFit = document.getElementById('btn-zoom-fit');
    dom.btnZoom100 = document.getElementById('btn-zoom-100');
    dom.zoomLevelText = document.getElementById('zoom-level-text');


    // Interaksi Kanvas, Tool Geser (Pan), Pembesar & Kaca Pembesar
    dom.btnToolPan = document.getElementById('btn-tool-pan');
    dom.btnToolZoom = document.getElementById('btn-tool-zoom');
    dom.btnToolLoupe = document.getElementById('btn-tool-loupe');
    dom.btnZoomCenter = document.getElementById('btn-zoom-center');
    dom.floatingLoupe = document.getElementById('floating-loupe');
    dom.floatingLoupeCanvas = document.getElementById('floating-loupe-canvas');
    dom.floatingLoupeCoords = document.getElementById('floating-loupe-coords');
    dom.floatingLoupeSwatch = document.getElementById('floating-loupe-swatch');
    dom.floatingLoupeHex = document.getElementById('floating-loupe-hex');
    // Status Bar
    dom.statusDims = document.getElementById('status-dims');
    dom.statusCoords = document.getElementById('status-coords');
    dom.statusRawSize = document.getElementById('status-raw-size');
    dom.statusMiniSwatch = document.getElementById('status-mini-swatch');
    dom.statusColorHex = document.getElementById('status-color-hex');
    dom.statusTime = document.getElementById('status-time');

    // Sidebar & Tabs
    dom.tabButtons = document.querySelectorAll('.tab-btn');
    dom.tabPanels = document.querySelectorAll('.tab-panel');

    // Tab 1: Transformasi
    dom.cropAspectBtns = document.querySelectorAll('[data-crop-aspect]');
    dom.btnStartCrop = document.getElementById('btn-start-crop');
    dom.btnApplyCrop = document.getElementById('btn-apply-crop');
    dom.btnCancelCrop = document.getElementById('btn-cancel-crop');
    dom.resizeW = document.getElementById('resize-w');
    dom.resizeH = document.getElementById('resize-h');
    dom.resizeAspectLock = document.getElementById('resize-aspect-lock');
    dom.resizeMethod = document.getElementById('resize-method');
    dom.btnApplyResize = document.getElementById('btn-apply-resize');
    dom.btnFlipH = document.getElementById('btn-flip-h');
    dom.btnFlipV = document.getElementById('btn-flip-v');
    dom.btnRot90CW = document.getElementById('btn-rot-90cw');
    dom.btnRot90CCW = document.getElementById('btn-rot-90ccw');
    dom.btnRot180 = document.getElementById('btn-rot-180');
    dom.sliderRotDeg = document.getElementById('slider-rot-deg');
    dom.labelRotDeg = document.getElementById('label-rot-deg');
    dom.btnApplyRotDeg = document.getElementById('btn-apply-rot-deg');

    // Tab 2: Pengolahan Warna
    dom.btnApplyGrayscale = document.getElementById('btn-apply-grayscale');
    dom.btnApplyInvert = document.getElementById('btn-apply-invert');
    dom.sliderBrightness = document.getElementById('slider-brightness');
    dom.labelBrightness = document.getElementById('label-brightness');
    dom.sliderContrast = document.getElementById('slider-contrast');
    dom.labelContrast = document.getElementById('label-contrast');
    dom.btnApplyBC = document.getElementById('btn-apply-bc');
    dom.sliderHue = document.getElementById('slider-hue');
    dom.labelHue = document.getElementById('label-hue');
    dom.sliderSat = document.getElementById('slider-sat');
    dom.labelSat = document.getElementById('label-sat');
    dom.btnApplyHSI = document.getElementById('btn-apply-hsi');
    dom.sliderBitDepth = document.getElementById('slider-bit-depth');
    dom.labelBitDepth = document.getElementById('label-bit-depth');
    dom.bitDepthInfo = document.getElementById('bit-depth-info');
    dom.btnApplyBitDepth = document.getElementById('btn-apply-bit-depth');

    // Tab 3: Inspektor
    dom.loupeCanvas = document.getElementById('loupe-canvas');
    dom.inspectorSwatch = document.getElementById('inspector-swatch');
    dom.inspectCoords = document.getElementById('inspect-coords');
    dom.inspectHex = document.getElementById('inspect-hex');
    dom.valRgb = document.getElementById('val-rgb');
    dom.valCmyk = document.getElementById('val-cmyk');
    dom.valHsi = document.getElementById('val-hsi');
    dom.valYiq = document.getElementById('val-yiq');
    dom.valYcbcr = document.getElementById('val-ycbcr');
    dom.channelViewSelect = document.getElementById('channel-view-select');
    dom.btnApplyChannelView = document.getElementById('btn-apply-channel-view');

    // Tab 4: Kompresi
    dom.subsamplingBtns = document.querySelectorAll('[data-subsampling]');
    dom.subsamplingDesc = document.getElementById('subsampling-desc');
    dom.btnApplySubsampling = document.getElementById('btn-apply-subsampling');
    dom.sliderExportQuality = document.getElementById('slider-export-quality');
    dom.labelExportQuality = document.getElementById('label-export-quality');
    dom.btnRunCompressionTest = document.getElementById('btn-run-compression-test');
    dom.btnDownloadCompressed = document.getElementById('btn-download-compressed');
    dom.compRawSize = document.getElementById('comp-raw-size');
    dom.compOrigSize = document.getElementById('comp-orig-size');
    dom.compResultSize = document.getElementById('comp-result-size');
    dom.compSavingsOrig = document.getElementById('comp-savings-orig');
    dom.compRatioRaw = document.getElementById('comp-ratio-raw');

    // Tab 5: Keamanan & Watermark
    dom.exifBadge = document.getElementById('exif-badge');
    dom.exifStatusDetail = document.getElementById('exif-status-detail');
    dom.watermarkText = document.getElementById('watermark-text');
    dom.watermarkPos = document.getElementById('watermark-pos');
    dom.watermarkSize = document.getElementById('watermark-size');
    dom.watermarkColor = document.getElementById('watermark-color');
    dom.sliderWmOpacity = document.getElementById('slider-wm-opacity');
    dom.labelWmOpacity = document.getElementById('label-wm-opacity');
    dom.sliderWmRot = document.getElementById('slider-wm-rot');
    dom.labelWmRot = document.getElementById('label-wm-rot');
    dom.watermarkBadgeToggle = document.getElementById('watermark-badge-toggle');
    dom.btnApplyWatermark = document.getElementById('btn-apply-watermark');

    // Tab 6: Metrik
    dom.metricPsnrVal = document.getElementById('metric-psnr-val');
    dom.metricPsnrQuality = document.getElementById('metric-psnr-quality');
    dom.metricMseVal = document.getElementById('metric-mse-val');
    dom.metricPsnrEval = document.getElementById('metric-psnr-eval');
    dom.mTableDims = document.getElementById('m-table-dims');
    dom.mTablePixels = document.getElementById('m-table-pixels');
    dom.mTableRaw = document.getElementById('m-table-raw');
    dom.mTableOrig = document.getElementById('m-table-orig');
    dom.mTableComp = document.getElementById('m-table-comp');
    dom.mTableRatio = document.getElementById('m-table-ratio');
    dom.mTableTime = document.getElementById('m-table-time');

    // Team Modal
    dom.teamModal = document.getElementById('team-modal');
    dom.btnCloseModal = document.getElementById('btn-close-modal');
    // Loading & Processing Overlays
    dom.appLoadingScreen = document.getElementById('app-loading-screen');
    dom.loadingBar = document.getElementById('loading-bar');
    dom.loadingStatusText = document.getElementById('loading-status-text');
    dom.processingOverlay = document.getElementById('processing-overlay');
    dom.processingTitle = document.getElementById('processing-title');
    dom.processingDetail = document.getElementById('processing-detail');

    // Histogram, Presets, Konvolusi & Privasi
    dom.histogramCanvas = document.getElementById('histogram-canvas');
    dom.histMeanLum = document.getElementById('hist-mean-lum');
    dom.histEntropy = document.getElementById('hist-entropy');
    dom.histTabBtns = document.querySelectorAll('[data-hist-mode]');
    dom.btnHistEqualize = document.getElementById('btn-hist-equalize');
    dom.btnContrastStretch = document.getElementById('btn-contrast-stretch');

    dom.presetBtns = document.querySelectorAll('[data-preset]');
    dom.creativeTemp = document.getElementById('slider-creative-temp');
    dom.creativeVignette = document.getElementById('slider-creative-vignette');
    dom.creativeGrain = document.getElementById('slider-creative-grain');
    dom.creativePosterize = document.getElementById('slider-creative-posterize');
    dom.creativeFade = document.getElementById('slider-creative-fade');
    dom.labelCreativeTemp = document.getElementById('label-creative-temp');
    dom.labelCreativeVignette = document.getElementById('label-creative-vignette');
    dom.labelCreativeGrain = document.getElementById('label-creative-grain');
    dom.labelCreativePosterize = document.getElementById('label-creative-posterize');
    dom.labelCreativeFade = document.getElementById('label-creative-fade');
    dom.btnApplyCreative = document.getElementById('btn-apply-creative');
    dom.btnResetCreative = document.getElementById('btn-reset-creative');
  }

  // ==========================================================================
  // Inisialisasi & Image Loader
  // ==========================================================================
  function showProcessing(title = 'Memproses Citra...', detail = 'Menghitung piksel matematika...') {
    if (dom.processingTitle) dom.processingTitle.textContent = title;
    if (dom.processingDetail) dom.processingDetail.textContent = detail;
    if (dom.processingOverlay) dom.processingOverlay.style.display = 'flex';
  }

  function hideProcessing() {
    if (dom.processingOverlay) dom.processingOverlay.style.display = 'none';
  }

  function initApp() {
    initDOMReferences();
    bindEvents();
    if (dom.btnNavClear) dom.btnNavClear.style.display = 'none';
    if (dom.btnCompareToggle) dom.btnCompareToggle.style.display = 'none';
    if (dom.btnExportQuick) dom.btnExportQuick.style.display = 'none';
    if (dom.appLoadingScreen) dom.appLoadingScreen.style.display = 'none';

    state.currentCanvas = dom.mainCanvas;
    state.currentCtx = dom.mainCanvas.getContext('2d', { willReadFrequently: true });
  }

  function animateAppLoadingScreen() {
    if (!dom.appLoadingScreen) return;
    const steps = [
      { pct: 25, text: 'Memuat modul ruang warna (RGB, HSI, CMYK, YIQ, YCbCr)...', delay: 100 },
      { pct: 60, text: 'Memuat modul transformasi geometri & sampling bilinear...', delay: 280 },
      { pct: 85, text: 'Menyiapkan engine kompresi chroma & sanitasi EXIF...', delay: 460 },
      { pct: 100, text: 'Studio kanvas siap digunakan!', delay: 650 }
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        if (dom.loadingBar) dom.loadingBar.style.width = `${step.pct}%`;
        if (dom.loadingStatusText) dom.loadingStatusText.textContent = step.text;
      }, step.delay);
    });

    setTimeout(() => {
      if (dom.appLoadingScreen) {
        dom.appLoadingScreen.classList.add('fade-out');
        setTimeout(() => {
          dom.appLoadingScreen.style.display = 'none';
        }, 500);
      }
    }, 900);
  }

  /**
   * Muat citra dari URL sampel
   */
  function loadSampleImage(url) {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], url.split('/').pop(), { type: blob.type });
        handleLoadedFile(file);
      })
      .catch((err) => {
        console.error('Gagal memuat sampel gambar:', err);
      });
  }

  /**
   * Proses file citra masukan
   */
  function handleLoadedFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Format file tidak didukung. Harap pilih gambar JPEG, PNG, atau WebP.');
      return;
    }
    showProcessing('Membuka & Mendekompresi Foto...', 'Membaca piksel dan memeriksa metadata EXIF...');

    const reader = new FileReader();
    reader.onload = function (e) {
      const buffer = e.target.result;

      // Cek segmen EXIF pada buffer biner
      const exifResult = Security.detectExif(buffer);
      updateExifCardUI(exifResult, file);

      // Muat citra ke HTMLImageElement
      const blob = new Blob([buffer], { type: file.type });
      const imgUrl = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = function () {
        hideProcessing();
        state.originalImage = img;
        state.originalFileData = {
          name: file.name,
          size: file.size,
          type: file.type,
          formattedSize: Compression.formatBytes(file.size)
        };

        // Render ke canvas
        renderImageToCanvas(img);

        // Reset history stack
        state.historyStack = [];
        state.redoStack = [];
        pushState('Gambar Awal Dimuat');

        state.panX = 0;
        state.panY = 0;
        state.zoom = 1.0;
        setActiveTool('pan');
        fitZoomToViewport();
        // Update UI
        dom.emptyState.style.display = 'none';
        dom.canvasWrapper.style.display = 'flex';
        dom.viewportControls.style.display = 'flex';
        if (dom.btnNavClear) dom.btnNavClear.style.display = 'inline-flex';
        if (dom.btnCompareToggle) dom.btnCompareToggle.style.display = 'inline-flex';
        if (dom.btnExportQuick) dom.btnExportQuick.style.display = 'inline-flex';

        updateDimensionInputs(img.width, img.height);
        updateStatusAndMetrics(0);

        // Run estimasi kompresi awal
        runCompressionEstimate();
      };

      img.src = imgUrl;
    };

    reader.readAsArrayBuffer(file);
  }

  /**
   * Render citra ke mainCanvas
   */
  function renderImageToCanvas(img) {
    state.currentCanvas.width = img.width;
    state.currentCanvas.height = img.height;
    state.currentCtx.drawImage(img, 0, 0);
  }

  /**
   * Tampilkan hasil deteksi EXIF pada kartu Keamanan
   */
  function updateExifCardUI(exifResult, file) {
    if (exifResult.hasExif) {
      dom.exifBadge.className = 'security-status-badge badge-green';
      dom.exifBadge.textContent = '✓ EXIF Terdeteksi & Berhasil Disanitasi';
      dom.exifStatusDetail.innerHTML = `File asli <strong>${file.name}</strong> mengandung segmen metadata EXIF (${exifResult.exifSize} byte) dengan potensi GPS/kamera. Melalui pemrosesan kanvas, <strong>100% metadata tersebut dibuang</strong> sehingga aman untuk dibagikan.`;
    } else {
      dom.exifBadge.className = 'security-status-badge badge-green';
      dom.exifBadge.textContent = '✓ Bersih dari Metadata Rahasia';
      dom.exifStatusDetail.innerHTML = `File <strong>${file.name}</strong> tidak memiliki metadata EXIF berbahaya. Kanvas web menjamin citra hasil unduhan tetap steril dari data sensitif.`;
    }
  }

  // ==========================================================================
  // Manajemen History (Undo / Redo / Reset)
  // ==========================================================================
  function pushState(name = 'Aksi') {
    const w = state.currentCanvas.width;
    const h = state.currentCanvas.height;
    const imgData = state.currentCtx.getImageData(0, 0, w, h);

    state.historyStack.push({
      width: w,
      height: h,
      data: new Uint8ClampedArray(imgData.data),
      name: name
    });

    if (state.historyStack.length > state.maxHistory) {
      state.historyStack.shift();
    }

    state.redoStack = [];
    updateHistoryButtons();
  }

  function applyUndo() {
    if (state.historyStack.length <= 1) return;

    const current = state.historyStack.pop();
    state.redoStack.push(current);

    const prev = state.historyStack[state.historyStack.length - 1];
    restoreCanvasState(prev);
    updateHistoryButtons();
    updateStatusAndMetrics(0);
    runCompressionEstimate();
  }

  function applyRedo() {
    if (state.redoStack.length === 0) return;

    const next = state.redoStack.pop();
    state.historyStack.push(next);

    restoreCanvasState(next);
    updateHistoryButtons();
    updateStatusAndMetrics(0);
    runCompressionEstimate();
  }

  function restoreCanvasState(snapshot) {
    state.currentCanvas.width = snapshot.width;
    state.currentCanvas.height = snapshot.height;
    const imgData = new ImageData(new Uint8ClampedArray(snapshot.data), snapshot.width, snapshot.height);
    state.currentCtx.putImageData(imgData, 0, 0);
    updateDimensionInputs(snapshot.width, snapshot.height);
  }

  function updateHistoryButtons() {
    dom.btnUndo.disabled = state.historyStack.length <= 1;
    dom.btnRedo.disabled = state.redoStack.length === 0;
  }

  function resetToOriginal() {
    if (!state.originalImage) return;
    renderImageToCanvas(state.originalImage);
    pushState('Reset ke Citra Asli');
    updateDimensionInputs(state.originalImage.width, state.originalImage.height);
    updateStatusAndMetrics(0);
    runCompressionEstimate();
  }
  function clearCurrentImage() {
    state.originalImage = null;
    state.originalFileData = null;
    state.historyStack = [];
    state.redoStack = [];

    state.panX = 0;
    state.panY = 0;
    state.zoom = 1.0;
    if (dom.floatingLoupe) dom.floatingLoupe.style.display = 'none';
    if (state.isComparing) {
      toggleComparisonMode();
    }
    if (state.cropState.active) {
      cancelCropMode();
    }

    if (state.currentCtx && state.currentCanvas) {
      state.currentCtx.clearRect(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      state.currentCanvas.width = 0;
      state.currentCanvas.height = 0;
    }

    dom.canvasWrapper.style.display = 'none';
    dom.viewportControls.style.display = 'none';
    dom.emptyState.style.display = 'flex';
    if (dom.btnNavClear) dom.btnNavClear.style.display = 'none';
    if (dom.btnCompareToggle) dom.btnCompareToggle.style.display = 'none';
    if (dom.btnExportQuick) dom.btnExportQuick.style.display = 'none';

    dom.statusDims.textContent = 'Dimensi: -';
    dom.statusCoords.textContent = 'Posisi: -';
    dom.statusRawSize.textContent = 'Ukuran Mentah: -';
    dom.statusColorHex.textContent = '#------';
    dom.statusMiniSwatch.style.backgroundColor = 'transparent';
    dom.statusTime.textContent = 'Waktu Proses: 0 ms';

    dom.metricPsnrVal.textContent = '-- dB';
    dom.metricPsnrQuality.textContent = 'Belum ada citra';
    dom.metricMseVal.textContent = '-';
    dom.metricPsnrEval.textContent = '-';
    dom.mTableDims.textContent = '-';
    dom.mTablePixels.textContent = '-';
    dom.mTableRaw.textContent = '-';
    dom.mTableOrig.textContent = '-';
    dom.mTableComp.textContent = '-';
    dom.mTableRatio.textContent = '-';
    dom.mTableTime.textContent = '-';

    dom.fileInput.value = '';
    updateHistoryButtons();
  }

  function makeDropTarget(el, onFileDrop) {
    if (!el) return;
    el.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over');
      if (dom.globalDragOverlay) dom.globalDragOverlay.style.display = 'none';
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        onFileDrop(e.dataTransfer.files[0]);
      }
    });
  }

  // ==========================================================================
  // Event Binding
  // ==========================================================================
  function bindEvents() {
    // Nav Actions
    dom.btnOpenFile.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleLoadedFile(e.target.files[0]);
      }
    });

    dom.btnSampleDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.sampleMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      dom.sampleMenu.classList.remove('active');
    });

    document.querySelectorAll('[data-sample]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const sampleUrl = btn.getAttribute('data-sample');
        loadSampleImage(sampleUrl);
      });
    });

    dom.btnUndo.addEventListener('click', applyUndo);
    dom.btnRedo.addEventListener('click', applyRedo);
    dom.btnReset.addEventListener('click', resetToOriginal);
    dom.btnCompareToggle.addEventListener('click', toggleComparisonMode);
    dom.btnExportQuick.addEventListener('click', downloadCurrentCanvas);
    dom.btnTeamInfo.addEventListener('click', () => (dom.teamModal.style.display = 'flex'));
    dom.btnCloseModal.addEventListener('click', () => (dom.teamModal.style.display = 'none'));
    dom.teamModal.addEventListener('click', (e) => {
      if (e.target === dom.teamModal) dom.teamModal.style.display = 'none';
    });
    // Opsi Unggah Tambahan
    if (dom.btnEmptyChoose) dom.btnEmptyChoose.addEventListener('click', () => dom.fileInput.click());
    if (dom.btnChangeImage) dom.btnChangeImage.addEventListener('click', () => dom.fileInput.click());
    if (dom.btnLoadSampleQuick) dom.btnLoadSampleQuick.addEventListener('click', () => loadSampleImage('assets/sample-testchart.png'));
    if (dom.btnNavClear) dom.btnNavClear.addEventListener('click', clearCurrentImage);
    if (dom.btnClearImage) dom.btnClearImage.addEventListener('click', clearCurrentImage);

    // Target Drag and Drop langsung ke tombol & area
    makeDropTarget(dom.emptyDropzone, handleLoadedFile);
    makeDropTarget(dom.btnEmptyChoose, handleLoadedFile);
    makeDropTarget(dom.btnOpenFile, handleLoadedFile);
    makeDropTarget(dom.btnChangeImage, handleLoadedFile);
    makeDropTarget(dom.mainCanvas, handleLoadedFile);
    makeDropTarget(dom.canvasWrapper, handleLoadedFile);

    if (dom.emptyDropzone) {
      dom.emptyDropzone.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          dom.fileInput.click();
        }
      });
    }
    // Klik area dropzone memicu file selector (kecuali klik tombol kamera/sampel)
    if (dom.emptyDropzone) {
      dom.emptyDropzone.addEventListener('click', (e) => {
        if (e.target.closest('#btn-empty-camera') || e.target.closest('#btn-load-sample-quick')) {
          return;
        }
        dom.fileInput.click();
      });
    }

    // Clipboard Paste (Ctrl + V)
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || window.clipboardData)?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleLoadedFile(file);
            break;
          }
        }
      }
    });

    // Fullscreen Drag & Drop Global
    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (dom.globalDragOverlay && e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        dom.globalDragOverlay.style.display = 'flex';
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (dom.globalDragOverlay) dom.globalDragOverlay.style.display = 'none';
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (dom.globalDragOverlay) dom.globalDragOverlay.style.display = 'none';
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleLoadedFile(e.dataTransfer.files[0]);
      }
    });

    // Kamera / Webcam
    let cameraStream = null;
    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Peramban Anda tidak mendukung akses kamera atau fitur ini membutuhkan protokol HTTPS/localhost.');
        return;
      }
      dom.cameraModal.style.display = 'flex';
      dom.cameraStatus.textContent = 'Mengakses kamera perangkat...';
      dom.btnCapturePhoto.disabled = true;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
        dom.cameraVideo.srcObject = cameraStream;
        dom.cameraVideo.onloadedmetadata = () => {
          dom.cameraVideo.play();
          dom.cameraStatus.textContent = 'Kamera aktif. Posisikan objek foto lalu klik "Jepret Foto".';
          dom.btnCapturePhoto.disabled = false;
        };
      } catch (err) {
        dom.cameraStatus.textContent = 'Gagal mengakses kamera: ' + (err.message || 'Izin ditolak atau kamera tidak ditemukan');
      }
    }

    function stopCamera() {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
      }
      if (dom.cameraVideo) dom.cameraVideo.srcObject = null;
      dom.cameraModal.style.display = 'none';
    }

    function captureFromCamera() {
      if (!dom.cameraVideo || !dom.cameraVideo.videoWidth) return;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = dom.cameraVideo.videoWidth;
      offCanvas.height = dom.cameraVideo.videoHeight;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(dom.cameraVideo, 0, 0);

      offCanvas.toBlob((blob) => {
        stopCamera();
        if (blob) {
          const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleLoadedFile(file);
        }
      }, 'image/jpeg', 0.95);
    }

    if (dom.btnCamera) dom.btnCamera.addEventListener('click', startCamera);
    if (dom.btnEmptyCamera) dom.btnEmptyCamera.addEventListener('click', startCamera);
    if (dom.btnCancelCamera) dom.btnCancelCamera.addEventListener('click', stopCamera);
    if (dom.btnCloseCamera) dom.btnCloseCamera.addEventListener('click', stopCamera);
    if (dom.btnCapturePhoto) dom.btnCapturePhoto.addEventListener('click', captureFromCamera);

    // Drag and Drop
    const dropArea = dom.viewport;
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-active');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-active');
      });
    });
    dropArea.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length > 0) {
        handleLoadedFile(e.dataTransfer.files[0]);
      }
    });

    // Interaksi Kanvas: Pan (Geser), Zoom (Pembesar), Loupe
    bindPanAndZoomEvents();
    // Sidebar Tab Switching
    dom.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        dom.tabButtons.forEach((b) => b.classList.remove('active'));
        dom.tabPanels.forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });

    // Main Canvas Mousemove & Touch (Inspector & Loupe)
    dom.mainCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    dom.mainCanvas.addEventListener('click', handleCanvasMouseMove);
    dom.mainCanvas.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) handleCanvasMouseMove(e);
    }, { passive: true });
    dom.mainCanvas.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length === 1) handleCanvasMouseMove(e);
    }, { passive: true });

    // Bind Module Controls
    bindTransformControls();
    bindColorControls();
    bindInspectorControls();
    bindCompressionControls();
    bindSecurityControls();
    bindCompareEvents();
    bindHistogramControls();
    bindPresetControls();
    bindCreativeLabControls();
    bindConvolutionControls();
  }

  // ==========================================================================
  // Zooming & Viewport Helper
  // ==========================================================================
  function applyCanvasTransform() {
    const transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    dom.mainCanvas.style.transform = transform;
    if (dom.compareCanvas) {
      dom.compareCanvas.style.transform = transform;
      if (state.isComparing) updateCompareSplitView();
    }
    if (state.cropState.active) {
      renderCropBox();
    }
  }

  function setZoom(val) {
    state.zoom = Math.max(0.15, Math.min(5.0, val));
    applyCanvasTransform();
    if (dom.zoomLevelText) {
      dom.zoomLevelText.textContent = `${Math.round(state.zoom * 100)}%`;
    }
  }

  function adjustZoom(delta) {
    setZoom(state.zoom + delta);
  }

  function fitZoomToViewport() {
    if (!state.currentCanvas || !state.currentCanvas.width) return;
    state.panX = 0;
    state.panY = 0;
    setZoom(1.0);
  }

  function zoomToActualSize() {
    if (!state.currentCanvas || !state.currentCanvas.width) return;
    const clientW = dom.mainCanvas.clientWidth || state.currentCanvas.width;
    const ratio = Math.max(1.0, state.currentCanvas.width / clientW);
    state.panX = 0;
    state.panY = 0;
    setZoom(ratio);
  }

  function resetPan() {
    state.panX = 0;
    state.panY = 0;
    applyCanvasTransform();
  }

  function zoomTowardsPoint(targetZoom, clientX, clientY) {
    const newZoom = Math.max(0.15, Math.min(5.0, targetZoom));
    if (Math.abs(newZoom - state.zoom) < 0.002) return;
    const ratio = newZoom / state.zoom;
    const rect = dom.mainCanvas.getBoundingClientRect();
    const canvasCenterX = rect.left + rect.width / 2;
    const canvasCenterY = rect.top + rect.height / 2;
    const dx = clientX - canvasCenterX;
    const dy = clientY - canvasCenterY;

    state.panX += -(ratio - 1) * dx;
    state.panY += -(ratio - 1) * dy;
    setZoom(newZoom);
  }

  function setActiveTool(tool) {
    state.activeTool = tool;
    if (dom.btnToolPan) dom.btnToolPan.classList.toggle('active', tool === 'pan');
    if (dom.btnToolZoom) dom.btnToolZoom.classList.toggle('active', tool === 'zoom');
    if (dom.btnToolLoupe) dom.btnToolLoupe.classList.toggle('active', tool === 'loupe');

    dom.mainCanvas.classList.remove('tool-zoom', 'tool-loupe');
    if (tool === 'zoom') {
      dom.mainCanvas.classList.add('tool-zoom');
    } else if (tool === 'loupe') {
      dom.mainCanvas.classList.add('tool-loupe');
    }

    if (tool !== 'loupe' && dom.floatingLoupe) {
      dom.floatingLoupe.style.display = 'none';
    }
  }

  function bindPanAndZoomEvents() {
    let isDragging = false;
    let dragDistance = 0;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;

    // Tombol toolbar kontrol
    if (dom.btnToolPan) dom.btnToolPan.addEventListener('click', () => setActiveTool('pan'));
    if (dom.btnToolZoom) dom.btnToolZoom.addEventListener('click', () => setActiveTool('zoom'));
    if (dom.btnToolLoupe) dom.btnToolLoupe.addEventListener('click', () => setActiveTool('loupe'));
    if (dom.btnZoomCenter) dom.btnZoomCenter.addEventListener('click', resetPan);

    if (dom.btnZoomIn) dom.btnZoomIn.addEventListener('click', () => adjustZoom(0.2));
    if (dom.btnZoomOut) dom.btnZoomOut.addEventListener('click', () => adjustZoom(-0.2));
    if (dom.btnZoomFit) dom.btnZoomFit.addEventListener('click', fitZoomToViewport);
    if (dom.btnZoom100) dom.btnZoom100.addEventListener('click', zoomToActualSize);

    // Roda mouse untuk zoom di posisi kursor
    dom.canvasWrapper.addEventListener('wheel', (e) => {
      if (!state.currentCanvas || !state.currentCanvas.width) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      zoomTowardsPoint(state.zoom * factor, e.clientX, e.clientY);
    }, { passive: false });

    function handleCanvasClickZoom(clientX, clientY, isZoomOut = false) {
      if (state.cropState.active || state.isComparing) return;
      if (!state.currentCanvas || !state.currentCanvas.width) return;

      const rect = dom.mainCanvas.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return;

      if (state.activeTool === 'zoom' || state.activeTool === 'pan') {
        if (isZoomOut) {
          zoomTowardsPoint(state.zoom / 1.4, clientX, clientY);
        } else if (state.zoom >= 3.8) {
          fitZoomToViewport();
        } else {
          const targetZoom = state.zoom < 1.0 ? 1.0 : state.zoom * 1.4;
          zoomTowardsPoint(targetZoom, clientX, clientY);
        }
      }
    }

    // Pointer Down (Mouse Drag / Geser)
    function onPointerDown(e) {
      if (!state.currentCanvas || !state.currentCanvas.width) return;
      if (state.cropState.active) return;
      if (state.isComparing && e.target === dom.compareHandle) return;

      const pt = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
      if (e.button !== undefined && e.button !== 0 && e.button !== 1) return;

      isDragging = true;
      dragDistance = 0;
      startX = pt.clientX;
      startY = pt.clientY;
      startPanX = state.panX;
      startPanY = state.panY;

      dom.mainCanvas.classList.add('is-dragging');
    }

    // Pointer Move
    function onPointerMove(e) {
      const pt = (e.touches && e.touches.length > 0) ? e.touches[0] : e;

      if (isDragging) {
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        dragDistance = Math.hypot(dx, dy);
        if (dragDistance > 6) {
          state.panX = startPanX + dx;
          state.panY = startPanY + dy;
          applyCanvasTransform();
        }
      }

      // Update floating loupe saat mode loupe aktif
      if (state.activeTool === 'loupe' && dom.floatingLoupe && state.currentCanvas && state.currentCanvas.width) {
        const rect = dom.mainCanvas.getBoundingClientRect();
        const wrapperRect = dom.canvasWrapper.getBoundingClientRect();
        const clientX = pt.clientX - rect.left;
        const clientY = pt.clientY - rect.top;

        if (clientX >= 0 && clientY >= 0 && clientX <= rect.width && clientY <= rect.height) {
          dom.floatingLoupe.style.display = 'flex';
          dom.floatingLoupe.style.left = `${pt.clientX - wrapperRect.left}px`;
          dom.floatingLoupe.style.top = `${pt.clientY - wrapperRect.top}px`;

          const scaleX = state.currentCanvas.width / rect.width;
          const scaleY = state.currentCanvas.height / rect.height;
          const x = Math.floor(clientX * scaleX);
          const y = Math.floor(clientY * scaleY);

          Inspector.renderLoupe(state.currentCanvas, dom.floatingLoupeCanvas, x, y, 5);
          const info = Inspector.inspectPixel(state.currentCanvas, x, y);
          if (info) {
            dom.floatingLoupeCoords.textContent = `X: ${x}, Y: ${y}`;
            dom.floatingLoupeSwatch.style.backgroundColor = info.hex;
            dom.floatingLoupeHex.textContent = info.hex;
          }
        } else {
          dom.floatingLoupe.style.display = 'none';
        }
      }
    }

    // Pointer Up
    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      dom.mainCanvas.classList.remove('is-dragging');

      // Touch click fallback
      if (e.changedTouches && e.changedTouches.length > 0 && dragDistance <= 6) {
        const pt = e.changedTouches[0];
        handleCanvasClickZoom(pt.clientX, pt.clientY, false);
      }
    }

    // Native click event on mainCanvas for desktop mouse
    dom.mainCanvas.addEventListener('click', (e) => {
      if (dragDistance > 6) return; // Abaikan jika ini operasi drag
      handleCanvasClickZoom(e.clientX, e.clientY, e.shiftKey || e.altKey);
    });
    // Double-click: toggle zoom cepat
    dom.mainCanvas.addEventListener('dblclick', (e) => {
      if (state.cropState.active) return;
      if (state.zoom > 1.15) {
        fitZoomToViewport();
      } else {
        zoomTowardsPoint(2.0, e.clientX, e.clientY);
      }
    });

    dom.canvasWrapper.addEventListener('mousedown', onPointerDown);
    dom.canvasWrapper.addEventListener('touchstart', onPointerDown, { passive: true });

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    // Contextmenu zoom-out
    dom.mainCanvas.addEventListener('contextmenu', (e) => {
      if (state.activeTool === 'zoom') {
        e.preventDefault();
        zoomTowardsPoint(state.zoom / 1.4, e.clientX, e.clientY);
      }
    });

    // Keyboard modifiers
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift' && state.activeTool === 'zoom') {
        dom.mainCanvas.classList.add('zoom-out');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        dom.mainCanvas.classList.remove('zoom-out');
      }
    });
  }

  // ==========================================================================
  // 1. Transformasi Controls (Crop, Resize, Flip, Rotate)
  // ==========================================================================
  function bindTransformControls() {
    // Crop Aspect Presets
    dom.cropAspectBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.cropAspectBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.cropState.aspect = btn.getAttribute('data-crop-aspect');
        updateCropBoxDimensions();
      });
    });

    // Start / Apply / Cancel Crop
    dom.btnStartCrop.addEventListener('click', startCropMode);
    dom.btnApplyCrop.addEventListener('click', applyCropAction);
    dom.btnCancelCrop.addEventListener('click', cancelCropMode);

    // Resize
    dom.resizeW.addEventListener('input', () => {
      if (dom.resizeAspectLock.checked && state.currentCanvas) {
        const ratio = state.currentCanvas.height / state.currentCanvas.width;
        dom.resizeH.value = Math.max(1, Math.round(dom.resizeW.value * ratio));
      }
    });

    dom.resizeH.addEventListener('input', () => {
      if (dom.resizeAspectLock.checked && state.currentCanvas) {
        const ratio = state.currentCanvas.width / state.currentCanvas.height;
        dom.resizeW.value = Math.max(1, Math.round(dom.resizeH.value * ratio));
      }
    });

    dom.btnApplyResize.addEventListener('click', applyResizeAction);

    // Flip
    dom.btnFlipH.addEventListener('click', () => {
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      Transformations.flipHorizontal(imgData);
      state.currentCtx.putImageData(imgData, 0, 0);
      const elapsed = performance.now() - t0;
      pushState('Balik Horizontal');
      updateStatusAndMetrics(elapsed);
    });

    dom.btnFlipV.addEventListener('click', () => {
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      Transformations.flipVertical(imgData);
      state.currentCtx.putImageData(imgData, 0, 0);
      const elapsed = performance.now() - t0;
      pushState('Balik Vertikal');
      updateStatusAndMetrics(elapsed);
    });

    // Rotate 90 CW
    dom.btnRot90CW.addEventListener('click', () => {
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      const rotated = Transformations.rotate90CW(imgData);
      state.currentCanvas.width = rotated.width;
      state.currentCanvas.height = rotated.height;
      state.currentCtx.putImageData(rotated, 0, 0);
      const elapsed = performance.now() - t0;
      pushState('Putar 90° CW');
      updateDimensionInputs(rotated.width, rotated.height);
      updateStatusAndMetrics(elapsed);
    });

    // Rotate 90 CCW
    dom.btnRot90CCW.addEventListener('click', () => {
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      const rotated = Transformations.rotate90CCW(imgData);
      state.currentCanvas.width = rotated.width;
      state.currentCanvas.height = rotated.height;
      state.currentCtx.putImageData(rotated, 0, 0);
      const elapsed = performance.now() - t0;
      pushState('Putar 90° CCW');
      updateDimensionInputs(rotated.width, rotated.height);
      updateStatusAndMetrics(elapsed);
    });

    // Rotate 180
    dom.btnRot180.addEventListener('click', () => {
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      const rotated = Transformations.rotate180(imgData);
      state.currentCtx.putImageData(rotated, 0, 0);
      const elapsed = performance.now() - t0;
      pushState('Putar 180°');
      updateStatusAndMetrics(elapsed);
    });

    // Arbitrary Rotation
    dom.sliderRotDeg.addEventListener('input', (e) => {
      dom.labelRotDeg.textContent = `${e.target.value}°`;
    });

    dom.btnApplyRotDeg.addEventListener('click', () => {
      const deg = parseFloat(dom.sliderRotDeg.value);
      if (deg === 0) return;
      const t0 = performance.now();
      const rotatedCanvas = Transformations.rotateArbitrary(state.currentCanvas, deg);
      state.currentCanvas.width = rotatedCanvas.width;
      state.currentCanvas.height = rotatedCanvas.height;
      state.currentCtx.drawImage(rotatedCanvas, 0, 0);
      const elapsed = performance.now() - t0;
      pushState(`Rotasi ${deg}°`);
      updateDimensionInputs(rotatedCanvas.width, rotatedCanvas.height);
      updateStatusAndMetrics(elapsed);
      dom.sliderRotDeg.value = 0;
      dom.labelRotDeg.textContent = '0°';
    });

    initCropDragEvents();
  }

  function updateDimensionInputs(w, h) {
    dom.resizeW.value = w;
    dom.resizeH.value = h;
  }

  function applyResizeAction() {
    const targetW = parseInt(dom.resizeW.value, 10);
    const targetH = parseInt(dom.resizeH.value, 10);
    const method = dom.resizeMethod.value;

    if (!targetW || !targetH || targetW <= 0 || targetH <= 0) {
      alert('Masukkan lebar dan tinggi yang valid (> 0)');
      return;
    }

    showProcessing('Sampling Ulang Citra...', `Menjalankan interpolasi ${method === 'bilinear' ? 'Bilinear 4-tetangga' : 'Nearest Neighbor'}...`);

    setTimeout(() => {
      const t0 = performance.now();
      const srcImgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      const resized = Transformations.resize(srcImgData, targetW, targetH, method);

      state.currentCanvas.width = targetW;
      state.currentCanvas.height = targetH;
      state.currentCtx.putImageData(resized, 0, 0);

      const elapsed = performance.now() - t0;
      pushState(`Resize ke ${targetW}x${targetH} (${method})`);
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();
      hideProcessing();
    }, 20);
  }

  // Crop Engine
  function startCropMode() {
    state.cropState.active = true;
    dom.cropOverlay.style.display = 'block';
    dom.btnStartCrop.style.display = 'none';
    dom.btnApplyCrop.style.display = 'inline-flex';
    dom.btnCancelCrop.style.display = 'inline-flex';

    // Inisialisasi crop box di tengah 70% kanvas
    const rect = dom.mainCanvas.getBoundingClientRect();
    const boxW = rect.width * 0.7;
    const boxH = rect.height * 0.7;
    const boxX = (rect.width - boxW) / 2;
    const boxY = (rect.height - boxH) / 2;

    state.cropState.x = boxX;
    state.cropState.y = boxY;
    state.cropState.w = boxW;
    state.cropState.h = boxH;

    renderCropBox();
  }

  function cancelCropMode() {
    state.cropState.active = false;
    dom.cropOverlay.style.display = 'none';
    dom.btnStartCrop.style.display = 'inline-flex';
    dom.btnApplyCrop.style.display = 'none';
    dom.btnCancelCrop.style.display = 'none';
  }

  function renderCropBox() {
    const c = state.cropState;
    const canvasRect = dom.mainCanvas.getBoundingClientRect();
    const wrapperRect = dom.canvasWrapper.getBoundingClientRect();

    // Posisi relatif terhadap wrapper
    const leftOffset = canvasRect.left - wrapperRect.left + c.x;
    const topOffset = canvasRect.top - wrapperRect.top + c.y;

    dom.cropBox.style.left = `${leftOffset}px`;
    dom.cropBox.style.top = `${topOffset}px`;
    dom.cropBox.style.width = `${c.w}px`;
    dom.cropBox.style.height = `${c.h}px`;
  }

  function updateCropBoxDimensions() {
    if (!state.cropState.active) return;
    const aspect = state.cropState.aspect;
    if (aspect === '1:1') {
      state.cropState.h = state.cropState.w;
    } else if (aspect === '4:3') {
      state.cropState.h = (state.cropState.w * 3) / 4;
    } else if (aspect === '16:9') {
      state.cropState.h = (state.cropState.w * 9) / 16;
    }
    renderCropBox();
  }

  function initCropDragEvents() {
    let isMoving = false;
    let isResizing = false;
    let currentHandle = null;
    let startMouseX = 0;
    let startMouseY = 0;
    let startBox = { x: 0, y: 0, w: 0, h: 0 };

    function onPointerDown(e) {
      e.stopPropagation();
      const pt = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
      if (e.target.classList.contains('crop-handle')) {
        isResizing = true;
        currentHandle = e.target.getAttribute('data-handle');
      } else {
        isMoving = true;
      }
      startMouseX = pt.clientX;
      startMouseY = pt.clientY;
      startBox = { ...state.cropState };
    }

    function onPointerMove(e) {
      if (!isMoving && !isResizing) return;
      if (e.cancelable && e.type === 'touchmove') {
        e.preventDefault();
      }
      const pt = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
      const dx = pt.clientX - startMouseX;
      const dy = pt.clientY - startMouseY;
      const canvasRect = dom.mainCanvas.getBoundingClientRect();

      if (isMoving) {
        state.cropState.x = Math.max(0, Math.min(canvasRect.width - startBox.w, startBox.x + dx));
        state.cropState.y = Math.max(0, Math.min(canvasRect.height - startBox.h, startBox.y + dy));
      } else if (isResizing) {
        if (currentHandle === 'se') {
          state.cropState.w = Math.max(30, Math.min(canvasRect.width - startBox.x, startBox.w + dx));
          state.cropState.h = Math.max(30, Math.min(canvasRect.height - startBox.y, startBox.h + dy));
        } else if (currentHandle === 'sw') {
          const newW = Math.max(30, startBox.w - dx);
          state.cropState.x = startBox.x + (startBox.w - newW);
          state.cropState.w = newW;
          state.cropState.h = Math.max(30, startBox.h + dy);
        } else if (currentHandle === 'ne') {
          state.cropState.w = Math.max(30, startBox.w + dx);
          const newH = Math.max(30, startBox.h - dy);
          state.cropState.y = startBox.y + (startBox.h - newH);
          state.cropState.h = newH;
        } else if (currentHandle === 'nw') {
          const newW = Math.max(30, startBox.w - dx);
          const newH = Math.max(30, startBox.h - dy);
          state.cropState.x = startBox.x + (startBox.w - newW);
          state.cropState.y = startBox.y + (startBox.h - newH);
          state.cropState.w = newW;
          state.cropState.h = newH;
        }
        updateCropBoxDimensions();
      }

      renderCropBox();
    }

    function onPointerUp() {
      isMoving = false;
      isResizing = false;
      currentHandle = null;
    }

    dom.cropBox.addEventListener('mousedown', onPointerDown);
    dom.cropBox.addEventListener('touchstart', onPointerDown, { passive: false });

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });

    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
  }

  function applyCropAction() {
    const canvasRect = dom.mainCanvas.getBoundingClientRect();
    const scaleX = state.currentCanvas.width / canvasRect.width;
    const scaleY = state.currentCanvas.height / canvasRect.height;

    const realX = Math.round(state.cropState.x * scaleX);
    const realY = Math.round(state.cropState.y * scaleY);
    const realW = Math.round(state.cropState.w * scaleX);
    const realH = Math.round(state.cropState.h * scaleY);

    const t0 = performance.now();
    const croppedCanvas = Transformations.crop(state.currentCanvas, realX, realY, realW, realH);

    state.currentCanvas.width = croppedCanvas.width;
    state.currentCanvas.height = croppedCanvas.height;
    state.currentCtx.drawImage(croppedCanvas, 0, 0);

    const elapsed = performance.now() - t0;
    cancelCropMode();
    pushState(`Crop (${realW}x${realH})`);
    updateDimensionInputs(realW, realH);
    updateStatusAndMetrics(elapsed);
    runCompressionEstimate();
  }

  // ==========================================
  // 2. Pengolahan Warna Controls
  // ==========================================
  function bindColorControls() {
    // Grayscale
    dom.btnApplyGrayscale.addEventListener('click', () => {
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      ColorModels.applyGrayscale(imgData);
      state.currentCtx.putImageData(imgData, 0, 0);
      const elapsed = performance.now() - t0;
      pushState('Grayscale NTSC');
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();
    });

    // Invert
    dom.btnApplyInvert.addEventListener('click', () => {
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      ColorModels.applyInvert(imgData);
      state.currentCtx.putImageData(imgData, 0, 0);
      const elapsed = performance.now() - t0;
      pushState('Invert Negatif');
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();
    });

    // Brightness & Contrast
    dom.sliderBrightness.addEventListener('input', (e) => {
      dom.labelBrightness.textContent = e.target.value;
    });

    dom.sliderContrast.addEventListener('input', (e) => {
      dom.labelContrast.textContent = e.target.value;
    });

    dom.btnApplyBC.addEventListener('click', () => {
      const bOffset = parseInt(dom.sliderBrightness.value, 10);
      const cOffset = parseInt(dom.sliderContrast.value, 10);
      if (bOffset === 0 && cOffset === 0) return;

      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      if (bOffset !== 0) ColorModels.applyBrightness(imgData, bOffset);
      if (cOffset !== 0) ColorModels.applyContrast(imgData, cOffset);
      state.currentCtx.putImageData(imgData, 0, 0);

      const elapsed = performance.now() - t0;
      pushState(`Kecerahan (${bOffset}) & Kontras (${cOffset})`);
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();

      dom.sliderBrightness.value = 0;
      dom.labelBrightness.textContent = '0';
      dom.sliderContrast.value = 0;
      dom.labelContrast.textContent = '0';
    });

    // HSI Hue & Saturation
    dom.sliderHue.addEventListener('input', (e) => {
      dom.labelHue.textContent = `${e.target.value}°`;
    });

    dom.sliderSat.addEventListener('input', (e) => {
      dom.labelSat.textContent = `${(e.target.value / 10).toFixed(1)}x`;
    });

    dom.btnApplyHSI.addEventListener('click', () => {
      const hueShift = parseInt(dom.sliderHue.value, 10);
      const satScale = parseFloat(dom.sliderSat.value) / 10;
      if (hueShift === 0 && satScale === 1.0) return;

      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      ColorModels.applyHueSaturation(imgData, hueShift, satScale);
      state.currentCtx.putImageData(imgData, 0, 0);

      const elapsed = performance.now() - t0;
      pushState(`HSI (Hue: ${hueShift}°, Sat: ${satScale.toFixed(1)}x)`);
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();

      dom.sliderHue.value = 0;
      dom.labelHue.textContent = '0°';
      dom.sliderSat.value = 10;
      dom.labelSat.textContent = '1.0x';
    });

    // Bit Depth Quantization
    dom.sliderBitDepth.addEventListener('input', (e) => {
      const bits = parseInt(e.target.value, 10);
      const levels = Math.pow(2, bits);
      const totalColors = Math.pow(levels, 3);
      dom.labelBitDepth.textContent = `${bits}-bit (${levels} level)`;
      dom.bitDepthInfo.textContent = `Total warna: ${totalColors.toLocaleString('id-ID')} warna (${bits * 3}-bit)`;
    });

    dom.btnApplyBitDepth.addEventListener('click', () => {
      const bits = parseInt(dom.sliderBitDepth.value, 10);
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      ColorModels.applyBitDepthReduction(imgData, bits);
      state.currentCtx.putImageData(imgData, 0, 0);

      const elapsed = performance.now() - t0;
      pushState(`Kuantisasi ${bits}-bit`);
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();
    });
  }

  // ==========================================
  // 3. Inspektor & Analisis Warna Controls
  // ==========================================
  function bindInspectorControls() {
    dom.btnApplyChannelView.addEventListener('click', () => {
      const mode = dom.channelViewSelect.value;
      if (mode === 'all') return;

      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      ColorModels.extractChannel(imgData, mode);
      state.currentCtx.putImageData(imgData, 0, 0);

      const elapsed = performance.now() - t0;
      pushState(`Tampilan Kanal: ${mode}`);
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();
    });
  }

  function handleCanvasMouseMove(e) {
    if (!state.currentCanvas || !state.currentCanvas.width) return;

    let posX = e.clientX;
    let posY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      posX = e.touches[0].clientX;
      posY = e.touches[0].clientY;
    }

    const rect = dom.mainCanvas.getBoundingClientRect();
    const clientX = posX - rect.left;
    const clientY = posY - rect.top;

    if (clientX < 0 || clientY < 0 || clientX >= rect.width || clientY >= rect.height) {
      return;
    }

    const scaleX = state.currentCanvas.width / rect.width;
    const scaleY = state.currentCanvas.height / rect.height;

    const x = Math.floor(clientX * scaleX);
    const y = Math.floor(clientY * scaleY);

    const info = Inspector.inspectPixel(state.currentCanvas, x, y);
    if (!info) return;

    // Update Status Bar
    dom.statusCoords.textContent = `Posisi: (${x}, ${y})`;
    dom.statusMiniSwatch.style.backgroundColor = info.hex;
    dom.statusColorHex.textContent = info.hex;

    // Update Inspector Tab Cards
    dom.inspectCoords.textContent = `Koordinat: (${x}, ${y})`;
    dom.inspectHex.textContent = info.hex;
    dom.inspectorSwatch.style.backgroundColor = info.hex;

    dom.valRgb.textContent = `R: ${info.rgba.r} | G: ${info.rgba.g} | B: ${info.rgba.b} | A: ${info.rgba.a}`;
    if (info.cmyk) {
      dom.valCmyk.textContent = `C: ${info.cmyk.c}% | M: ${info.cmyk.m}% | Y: ${info.cmyk.y}% | K: ${info.cmyk.k}%`;
    }
    if (info.hsi) {
      dom.valHsi.textContent = `H: ${info.hsi.h}° | S: ${(info.hsi.s * 100).toFixed(1)}% | I: ${info.hsi.i255}`;
    }
    if (info.yiq) {
      dom.valYiq.textContent = `Y: ${info.yiq.y} | I: ${info.yiq.i} | Q: ${info.yiq.q}`;
    }
    if (info.ycbcr) {
      dom.valYcbcr.textContent = `Y: ${info.ycbcr.y} | Cb: ${info.ycbcr.cb} | Cr: ${info.ycbcr.cr}`;
    }

    // Render Loupe Magnifier Canvas
    Inspector.renderLoupe(state.currentCanvas, dom.loupeCanvas, x, y, 4);
  }

  // ==========================================
  // 4. Kompresi & Chroma Subsampling Controls
  // ==========================================
  function bindCompressionControls() {
    dom.subsamplingBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.subsamplingBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.subsamplingMode = btn.getAttribute('data-subsampling');

        if (state.subsamplingMode === '4:4:4') {
          dom.subsamplingDesc.innerHTML =
            '<strong>4:4:4 (Penuh)</strong>: Tanpa kompresi warna, setiap piksel memiliki Cb & Cr lengkap.';
        } else if (state.subsamplingMode === '4:2:2') {
          dom.subsamplingDesc.innerHTML =
            '<strong>4:2:2 (Horizontal 2x1)</strong>: Cb & Cr dirata-rata horizontal per 2 piksel. Menghemat 33% bandwidth warna.';
        } else if (state.subsamplingMode === '4:2:0') {
          dom.subsamplingDesc.innerHTML =
            '<strong>4:2:0 (Blok 2x2)</strong>: Cb & Cr dirata-rata per blok 4 piksel (standar JPEG). Menghemat 50% data warna.';
        }
      });
    });

    dom.btnApplySubsampling.addEventListener('click', () => {
      const mode = state.subsamplingMode;
      const t0 = performance.now();
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      Compression.applyChromaSubsampling(imgData, mode);
      state.currentCtx.putImageData(imgData, 0, 0);

      const elapsed = performance.now() - t0;
      pushState(`Chroma Subsampling ${mode}`);
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();
    });

    dom.sliderExportQuality.addEventListener('input', (e) => {
      dom.labelExportQuality.textContent = `${e.target.value}%`;
    });

    dom.btnRunCompressionTest.addEventListener('click', runCompressionEstimate);
    dom.btnDownloadCompressed.addEventListener('click', downloadCurrentCanvas);
  }

  /**
   * Menjalankan uji estimasi ukuran kompresi secara asinkron
   */
  async function runCompressionEstimate() {
    if (!state.currentCanvas || !state.currentCanvas.width) return;

    const formatRadio = document.querySelector('input[name="export-format"]:checked');
    const format = formatRadio ? formatRadio.value : 'image/jpeg';
    const quality = parseInt(dom.sliderExportQuality.value, 10) / 100;

    const rawMetrics = Compression.calculateRawSize(state.currentCanvas.width, state.currentCanvas.height);
    dom.compRawSize.textContent = rawMetrics.formatted;

    const origBytes = state.originalFileData ? state.originalFileData.size : rawMetrics.bytes;
    dom.compOrigSize.textContent = state.originalFileData
      ? state.originalFileData.formattedSize
      : rawMetrics.formatted;

    try {
      const result = await Compression.exportCanvas(state.currentCanvas, format, quality);
      dom.compResultSize.textContent = `${result.formattedSize} (${result.mimeType.split('/')[1].toUpperCase()})`;

      const compMetrics = Compression.calculateCompressionMetrics(origBytes, result.size, rawMetrics.bytes);
      dom.compSavingsOrig.textContent = `${compMetrics.savingsVsOriginal} (Rasio ${compMetrics.ratioVsOriginal})`;
      dom.compRatioRaw.textContent = `${compMetrics.ratioVsRaw} (${compMetrics.savingsVsRaw} lebih hemat)`;

      // Update tabel metrik di tab 6
      dom.mTableComp.textContent = result.formattedSize;
      dom.mTableRatio.textContent = compMetrics.savingsVsOriginal;
    } catch (err) {
      console.warn('Estimasi kompresi error:', err);
    }
  }

  function showToast(message, type = 'warning') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `app-toast show ${type}`;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.className = 'app-toast';
    }, 3000);
  }

  /**
   * Download hasil kanvas ke perangkat pengguna
   */
  async function downloadCurrentCanvas() {
    if (!state.originalImage || !state.currentCanvas || state.currentCanvas.width === 0 || state.currentCanvas.height === 0) {
      showToast('Tidak ada gambar untuk di unduh', 'warning');
      alert('Tidak ada gambar untuk di unduh');
      return;
    }

    const formatRadio = document.querySelector('input[name="export-format"]:checked');
    const format = formatRadio ? formatRadio.value : 'image/jpeg';
    const quality = parseInt(dom.sliderExportQuality.value, 10) / 100;

    try {
      const result = await Compression.exportCanvas(state.currentCanvas, format, quality);
      const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
      const origName = state.originalFileData ? state.originalFileData.name.replace(/\.[^/.]+$/, '') : 'editor-citra';
      const filename = `${origName}-edited.${ext}`;

      const link = document.createElement('a');
      link.href = result.url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Gagal mengekspor gambar: ' + err.message);
    }
  }

  // ==========================================
  // 5. Keamanan & Watermark Controls
  // ==========================================
  function bindSecurityControls() {
    dom.sliderWmOpacity.addEventListener('input', (e) => {
      dom.labelWmOpacity.textContent = `${e.target.value}%`;
    });

    dom.sliderWmRot.addEventListener('input', (e) => {
      dom.labelWmRot.textContent = `${e.target.value}°`;
    });

    dom.btnApplyWatermark.addEventListener('click', () => {
      const text = dom.watermarkText.value.trim();
      if (!text) {
        alert('Tuliskan teks watermark terlebih dahulu');
        return;
      }

      const options = {
        text: text,
        position: dom.watermarkPos.value,
        fontSize: parseInt(dom.watermarkSize.value, 10) || 28,
        color: dom.watermarkColor.value,
        opacity: parseInt(dom.sliderWmOpacity.value, 10) / 100,
        rotation: parseInt(dom.sliderWmRot.value, 10) || 0,
        badge: dom.watermarkBadgeToggle.checked
      };

      const t0 = performance.now();
      Security.applyTextWatermark(state.currentCanvas, options);
      const elapsed = performance.now() - t0;

      pushState('Watermark Teks Diterapkan');
      updateStatusAndMetrics(elapsed);
      runCompressionEstimate();
    });
  }

  // ==========================================
  // 6. Before / After Comparison Split View
  // ==========================================
  function toggleComparisonMode() {
    if (!state.originalImage) return;

    state.isComparing = !state.isComparing;
    if (state.isComparing) {
      dom.btnCompareToggle.classList.add('btn-primary');
      dom.btnCompareToggle.classList.remove('btn-secondary');
      dom.compareContainer.style.display = 'block';

      // Siapkan compareCanvas
      dom.compareCanvas.width = state.currentCanvas.width;
      dom.compareCanvas.height = state.currentCanvas.height;
      const cmpCtx = dom.compareCanvas.getContext('2d');
      cmpCtx.drawImage(state.originalImage, 0, 0, state.currentCanvas.width, state.currentCanvas.height);

      updateCompareSplitView();
    } else {
      dom.btnCompareToggle.classList.remove('btn-primary');
      dom.btnCompareToggle.classList.add('btn-secondary');
      dom.compareContainer.style.display = 'none';
    }
  }

  function bindCompareEvents() {
    let isDraggingHandle = false;

    function onDragStart(e) {
      if (!state.isComparing) return;
      isDraggingHandle = true;
    }

    function onDragMove(e) {
      if (!isDraggingHandle || !state.isComparing) return;
      if (e.cancelable && e.type === 'touchmove') {
        e.preventDefault();
      }
      const pt = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
      const rect = dom.mainCanvas.getBoundingClientRect();
      const clientX = pt.clientX - rect.left;
      const ratio = Math.max(0.02, Math.min(0.98, clientX / rect.width));
      state.compareSplit = ratio;
      updateCompareSplitView();
    }

    function onDragEnd() {
      isDraggingHandle = false;
    }

    dom.compareHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onDragStart(e);
    });
    dom.compareHandle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onDragStart(e);
    }, { passive: false });

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('touchmove', onDragMove, { passive: false });

    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchend', onDragEnd);
  }

  function updateCompareSplitView() {
    if (!state.isComparing) return;
    const rect = dom.mainCanvas.getBoundingClientRect();
    const splitX = rect.left + rect.width * state.compareSplit;

    dom.compareHandle.style.left = `${rect.left + rect.width * state.compareSplit}px`;
    dom.compareHandle.style.top = `${rect.top}px`;
    dom.compareHandle.style.height = `${rect.height}px`;

    // Clip compare canvas agar hanya separuh kiri
    dom.compareCanvas.style.clipPath = `polygon(0 0, ${state.compareSplit * 100}% 0, ${state.compareSplit * 100}% 100%, 0 100%)`;
    dom.compareCanvas.style.transform = dom.mainCanvas.style.transform;
  }

  // ==========================================
  // 7. Update Status Bar & Metrik Pengukuran
  // ==========================================
  function updateStatusAndMetrics(elapsedTimeMs = 0) {
    if (!state.currentCanvas || !state.currentCanvas.width) return;

    const w = state.currentCanvas.width;
    const h = state.currentCanvas.height;
    const rawMetrics = Compression.calculateRawSize(w, h);

    // Status Bar
    dom.statusDims.textContent = `Dimensi: ${w} × ${h} px`;
    dom.statusRawSize.textContent = `Ukuran Mentah: ${rawMetrics.formatted}`;
    dom.statusTime.textContent = `Waktu Proses: ${Math.round(elapsedTimeMs)} ms`;

    // Metrics Table
    dom.mTableDims.textContent = `${w} × ${h} px`;
    dom.mTablePixels.textContent = `${(w * h).toLocaleString('id-ID')} px`;
    dom.mTableRaw.textContent = `${rawMetrics.formatted} (${rawMetrics.bytes.toLocaleString('id-ID')} byte)`;
    dom.mTableOrig.textContent = state.originalFileData
      ? `${state.originalFileData.formattedSize} (${state.originalFileData.size.toLocaleString('id-ID')} byte)`
      : rawMetrics.formatted;
    dom.mTableTime.textContent = `${elapsedTimeMs.toFixed(2)} ms`;

    // Hitung PSNR jika dimensi gambar cocok dengan citra asli
    if (state.originalImage) {
      if (state.originalImage.width === w && state.originalImage.height === h) {
        // Buat temporary canvas untuk mendapatkan ImageData original
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(state.originalImage, 0, 0);

        const origData = tempCtx.getImageData(0, 0, w, h);
        const currData = state.currentCtx.getImageData(0, 0, w, h);

        const psnrResult = Compression.calculatePSNR(origData, currData);
        if (psnrResult.mse !== null) {
          dom.metricPsnrVal.textContent = psnrResult.psnrString;
          dom.metricPsnrQuality.textContent = `Kualitas Citra: ${psnrResult.quality}`;
          dom.metricMseVal.textContent = psnrResult.mse.toFixed(2);
          dom.metricPsnrEval.textContent = psnrResult.quality;
        }
      } else {
        dom.metricPsnrVal.textContent = 'N/A';
        dom.metricPsnrQuality.textContent = 'Dimensi citra telah berubah (di-crop / di-resize)';
        dom.metricMseVal.textContent = '-';
        dom.metricPsnrEval.textContent = 'Dimensi Berbeda';
      }
    }

    // Perbarui kurva histogram dan statistik kecerahan/entropi
    updateHistogram();
  }

  // ==========================================
  // 8. Modul Lanjutan (Histogram, Konvolusi, Privasi, Shortcuts)
  // ==========================================
  function updateHistogram() {
    if (!state.currentCanvas || !state.currentCanvas.width || !window.FiltersConvolution || !dom.histogramCanvas) return;
    try {
      const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
      const hist = FiltersConvolution.computeHistogram(imgData);
      FiltersConvolution.drawHistogram(dom.histogramCanvas, hist, state.histMode);
      if (dom.histMeanLum) dom.histMeanLum.textContent = hist.meanLuminance;
      if (dom.histEntropy) dom.histEntropy.textContent = `${hist.entropy} bits`;
    } catch (e) {
      console.warn('Histogram render error:', e);
    }
  }

  function bindHistogramControls() {
    if (dom.histTabBtns) {
      dom.histTabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          dom.histTabBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          state.histMode = btn.getAttribute('data-hist-mode');
          updateHistogram();
        });
      });
    }

    if (dom.btnHistEqualize) {
      dom.btnHistEqualize.addEventListener('click', () => {
        showProcessing('Ekualisasi Histogram...', 'Menghitung fungsi distribusi kumulatif CDF...');
        setTimeout(() => {
          const t0 = performance.now();
          const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
          FiltersConvolution.applyHistogramEqualization(imgData);
          state.currentCtx.putImageData(imgData, 0, 0);
          const elapsed = performance.now() - t0;
          pushState('Ekualisasi Histogram (CDF)');
          updateStatusAndMetrics(elapsed);
          runCompressionEstimate();
          hideProcessing();
        }, 20);
      });
    }

    if (dom.btnContrastStretch) {
      dom.btnContrastStretch.addEventListener('click', () => {
        showProcessing('Peregangan Kontras...', 'Membentangkan nilai piksel min-max ke rentang 0-255...');
        setTimeout(() => {
          const t0 = performance.now();
          const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
          FiltersConvolution.applyContrastStretching(imgData);
          state.currentCtx.putImageData(imgData, 0, 0);
          const elapsed = performance.now() - t0;
          pushState('Peregangan Kontras');
          updateStatusAndMetrics(elapsed);
          runCompressionEstimate();
          hideProcessing();
        }, 20);
      });
    }
  }

  function bindPresetControls() {
    if (dom.presetBtns) {
      dom.presetBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const pName = btn.getAttribute('data-preset');
          showProcessing(`Menerapkan Preset ${pName}...`, 'Menyesuaikan kurva warna...');
          setTimeout(() => {
            const t0 = performance.now();
            const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
            FiltersConvolution.applyPresetFilter(imgData, pName);
            state.currentCtx.putImageData(imgData, 0, 0);
            const elapsed = performance.now() - t0;
            pushState(`Preset: ${pName}`);
            updateStatusAndMetrics(elapsed);
            runCompressionEstimate();
            hideProcessing();
          }, 20);
        });
      });
    }
  }

  function setMatrixInputs(weights, divisor = 1, bias = 0) {
    const ids = ['k00', 'k01', 'k02', 'k10', 'k11', 'k12', 'k20', 'k21', 'k22'];
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && weights[i] !== undefined) el.value = weights[i];
    });
    if (dom.kernelDivisor) dom.kernelDivisor.value = divisor;
    if (dom.kernelBias) dom.kernelBias.value = bias;
  }

  function bindConvolutionControls() {
    const btnResetKernel = document.getElementById('btn-reset-kernel');
    if (btnResetKernel) {
      btnResetKernel.addEventListener('click', () => {
        setMatrixInputs([0, 0, 0, 0, 1, 0, 0, 0, 0], 1, 0);
      });
    }

    if (dom.kernelBtns) {
      dom.kernelBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const kName = btn.getAttribute('data-kernel');

          // Sinkronkan angka ke dalam editor matriks 3x3
          if (kName === 'sobel') {
            setMatrixInputs([-1, 0, 1, -2, 0, 2, -1, 0, 1], 1, 0);
          } else if (FiltersConvolution.KERNELS[kName]) {
            const kd = FiltersConvolution.KERNELS[kName];
            setMatrixInputs(kd.weights, kd.divisor, kd.bias);
          }

          showProcessing(`Filter Konvolusi: ${kName}...`, 'Menghitung matriks konvolusi 2D...');
          setTimeout(() => {
            const t0 = performance.now();
            const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
            let resultData;
            if (kName === 'sobel') {
              resultData = FiltersConvolution.applySobelEdge(imgData);
            } else {
              const kDef = FiltersConvolution.KERNELS[kName];
              if (!kDef) return hideProcessing();
              resultData = FiltersConvolution.convolve3x3(imgData, kDef.weights, kDef.divisor, kDef.bias);
            }
            state.currentCtx.putImageData(resultData, 0, 0);
            const elapsed = performance.now() - t0;
            pushState(`Konvolusi: ${kName}`);
            updateStatusAndMetrics(elapsed);
            runCompressionEstimate();
            hideProcessing();
          }, 20);
        });
      });
    }

    if (dom.btnApplyCustomKernel) {
      dom.btnApplyCustomKernel.addEventListener('click', () => {
        const weights = [
          parseFloat(document.getElementById('k00')?.value) || 0,
          parseFloat(document.getElementById('k01')?.value) || 0,
          parseFloat(document.getElementById('k02')?.value) || 0,
          parseFloat(document.getElementById('k10')?.value) || 0,
          parseFloat(document.getElementById('k11')?.value) || 0,
          parseFloat(document.getElementById('k12')?.value) || 0,
          parseFloat(document.getElementById('k20')?.value) || 0,
          parseFloat(document.getElementById('k21')?.value) || 0,
          parseFloat(document.getElementById('k22')?.value) || 0
        ];
        const divisor = parseFloat(dom.kernelDivisor?.value) || 1;
        const bias = parseFloat(dom.kernelBias?.value) || 0;

        showProcessing('Konvolusi Matriks Kustom...', 'Menghitung perkalian bobot spasial...');
        setTimeout(() => {
          const t0 = performance.now();
          const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
          const resultData = FiltersConvolution.convolve3x3(imgData, weights, divisor, bias);
          state.currentCtx.putImageData(resultData, 0, 0);
          const elapsed = performance.now() - t0;
          pushState('Kernel Konvolusi Kustom');
          updateStatusAndMetrics(elapsed);
          runCompressionEstimate();
          hideProcessing();
        }, 20);
      });
    }
  }

  function bindSensorControls() {
    if (dom.sliderSensorBlock) {
      dom.sliderSensorBlock.addEventListener('input', (e) => {
        if (dom.labelSensorBlock) dom.labelSensorBlock.textContent = `${e.target.value} px`;
      });
    }

    if (dom.btnStartSensor) {
      dom.btnStartSensor.addEventListener('click', () => {
        startCropMode();
        if (dom.btnApplyCrop) dom.btnApplyCrop.style.display = 'none';
        if (dom.btnCancelCrop) dom.btnCancelCrop.style.display = 'none';
        if (dom.btnStartSensor) dom.btnStartSensor.style.display = 'none';
        if (dom.btnApplySensor) dom.btnApplySensor.style.display = 'inline-flex';
        if (dom.btnCancelSensor) dom.btnCancelSensor.style.display = 'inline-flex';
      });
    }

    function cancelSensorMode() {
      cancelCropMode();
      if (dom.btnStartSensor) dom.btnStartSensor.style.display = 'inline-flex';
      if (dom.btnApplySensor) dom.btnApplySensor.style.display = 'none';
      if (dom.btnCancelSensor) dom.btnCancelSensor.style.display = 'none';
    }

    if (dom.btnCancelSensor) dom.btnCancelSensor.addEventListener('click', cancelSensorMode);

    if (dom.btnApplySensor) {
      dom.btnApplySensor.addEventListener('click', () => {
        const canvasRect = dom.mainCanvas.getBoundingClientRect();
        const scaleX = state.currentCanvas.width / canvasRect.width;
        const scaleY = state.currentCanvas.height / canvasRect.height;

        const realX = Math.round(state.cropState.x * scaleX);
        const realY = Math.round(state.cropState.y * scaleY);
        const realW = Math.round(state.cropState.w * scaleX);
        const realH = Math.round(state.cropState.h * scaleY);
        const blockSize = parseInt(dom.sliderSensorBlock?.value, 10) || 12;

        showProcessing('Menerapkan Sensor Privasi...', 'Merata-ratakan blok piksel sensitif...');
        setTimeout(() => {
          const t0 = performance.now();
          const imgData = state.currentCtx.getImageData(0, 0, state.currentCanvas.width, state.currentCanvas.height);
          FiltersConvolution.applyPrivacyPixelate(imgData, realX, realY, realW, realH, blockSize);
          state.currentCtx.putImageData(imgData, 0, 0);

          const elapsed = performance.now() - t0;
          cancelSensorMode();
          pushState('Sensor Privasi Pikselasi');
          updateStatusAndMetrics(elapsed);
          runCompressionEstimate();
          hideProcessing();
        }, 20);
      });
    }
  }

  function bindShortcuts() {
    if (dom.btnPrintReport) {
      dom.btnPrintReport.addEventListener('click', () => window.print());
    }

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) applyRedo();
          else applyUndo();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          applyRedo();
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          downloadCurrentCanvas();
        } else if (e.key === 'o' || e.key === 'O') {
          e.preventDefault();
          dom.fileInput?.click();
        }
      }
    });
  }

  function bindDeviceAndTouchEvents() {

    // Mobile Drawer Open / Close / Toggle
    function openMobileDrawer() {
      if (dom.sidebar) dom.sidebar.classList.add('drawer-open');
      if (dom.sidebarBackdrop) dom.sidebarBackdrop.classList.add('active');
      document.body.classList.add('drawer-open');
    }

    function closeMobileDrawer() {
      if (dom.sidebar) dom.sidebar.classList.remove('drawer-open');
      if (dom.sidebarBackdrop) dom.sidebarBackdrop.classList.remove('active');
      document.body.classList.remove('drawer-open');
    }

    function toggleMobileDrawer() {
      if (dom.sidebar && dom.sidebar.classList.contains('drawer-open')) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
    }

    if (dom.btnToggleSidebar) {
      dom.btnToggleSidebar.addEventListener('click', toggleMobileDrawer);
    }

    if (dom.btnCloseSidebar) {
      dom.btnCloseSidebar.addEventListener('click', closeMobileDrawer);
    }

    if (dom.floatingSidebarBtn) {
      dom.floatingSidebarBtn.addEventListener('click', openMobileDrawer);
    }

    if (dom.sidebarBackdrop) {
      dom.sidebarBackdrop.addEventListener('click', closeMobileDrawer);
    }

    const btnMobileUndo = document.getElementById('btn-mobile-undo');
    const btnMobileRedo = document.getElementById('btn-mobile-redo');
    const btnMobileReset = document.getElementById('btn-mobile-reset');
    if (btnMobileUndo) btnMobileUndo.addEventListener('click', applyUndo);
    if (btnMobileRedo) btnMobileRedo.addEventListener('click', applyRedo);
    if (btnMobileReset) btnMobileReset.addEventListener('click', resetToOriginal);

    // Auto-fit zoom on window resize
    window.addEventListener('resize', () => {
      fitZoomToViewport();
    });

    // Pinch-to-zoom pada perangkat layar sentuh
    let initialTouchDist = 0;
    let initialZoom = 1.0;

    dom.mainCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = state.zoom;
      }
    }, { passive: true });

    dom.mainCanvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialTouchDist > 0) {
        const curDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = curDist / initialTouchDist;
        setZoom(initialZoom * scale);
      }
    }, { passive: true });

    dom.mainCanvas.addEventListener('touchend', () => {
      initialTouchDist = 0;
    });
  }

  // Jalankan saat dokumen selesai dimuat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
