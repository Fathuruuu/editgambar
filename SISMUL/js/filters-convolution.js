/**
 * filters-convolution.js
 * Sistem Multimedia - Kelompok 2
 * Implementasi Lanjutan:
 * - Histogram Interaktif (RGB, Y-Luminansi) & Ekualisasi Histogram (CDF Mapping)
 * - Peregangan Kontras (Contrast Stretching / Auto Levels)
 * - Entropi Informasi Citra (Shannon Entropy)
 * - Filter Konvolusi Spasial (Gaussian Blur, Box Blur, Sharpen, Sobel Edge, Emboss)
 * - Custom 3x3 Convolution Matrix Editor
 * - Filter Preset Sinematik (Sepia, Teal & Orange, Vintage Film, Emerald)
 * - Sensor Pikselasi Privasi (Pixelate / Redaction untuk KTP / Pas Foto)
 */

(function (global) {
  'use strict';

  const FiltersConvolution = {};

  function clamp(val, min = 0, max = 255) {
    return Math.max(min, Math.min(max, val));
  }

  // ==========================================
  // 1. Histogram & Ekualisasi Histogram
  // ==========================================

  /**
   * Menghitung distribusi frekuensi 256-bin untuk kanal R, G, B, dan Luminansi Y
   * Serta menghitung Entropi Informasi Shannon dan Kecerahan Rata-Rata (Mean)
   */
  FiltersConvolution.computeHistogram = function (imageData) {
    const data = imageData.data;
    const len = data.length;
    const totalPixels = imageData.width * imageData.height;

    const rHist = new Uint32Array(256);
    const gHist = new Uint32Array(256);
    const bHist = new Uint32Array(256);
    const yHist = new Uint32Array(256);

    let sumLuminance = 0;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      rHist[r]++;
      gHist[g]++;
      bHist[b]++;
      yHist[y]++;
      sumLuminance += y;
    }

    let maxCount = 0;
    let entropy = 0;

    for (let i = 0; i < 256; i++) {
      if (rHist[i] > maxCount) maxCount = rHist[i];
      if (gHist[i] > maxCount) maxCount = gHist[i];
      if (bHist[i] > maxCount) maxCount = bHist[i];

      const p = yHist[i] / totalPixels;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    const meanLuminance = Math.round((sumLuminance / totalPixels) * 10) / 10;

    return {
      r: rHist,
      g: gHist,
      b: bHist,
      y: yHist,
      maxCount: maxCount,
      meanLuminance: meanLuminance,
      entropy: Math.round(entropy * 100) / 100, // bits/pixel
      totalPixels: totalPixels
    };
  };

  /**
   * Menggambar kurva histogram ke dalam target canvas
   * @param {HTMLCanvasElement} canvas
   * @param {Object} histData - Hasil dari computeHistogram
   * @param {string} mode - 'all' | 'rgb' | 'y'
   */
  FiltersConvolution.drawHistogram = function (canvas, histData, mode = 'all') {
    if (!canvas || !histData) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid halus
    ctx.fillStyle = '#0f121a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += w / 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += h / 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const max = histData.maxCount || 1;
    const binWidth = w / 256;

    function renderChannelCurve(histArray, color, fillRgba) {
      ctx.fillStyle = fillRgba;
      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let i = 0; i < 256; i++) {
        const val = histArray[i];
        const barH = (val / max) * (h - 4);
        const x = i * binWidth;
        const y = h - barH;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Stroke garis atas
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 256; i++) {
        const val = histArray[i];
        const barH = (val / max) * (h - 4);
        const x = i * binWidth;
        const y = h - barH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    if (mode === 'all' || mode === 'rgb') {
      ctx.globalCompositeOperation = 'screen';
      renderChannelCurve(histData.r, '#ef4444', 'rgba(239, 68, 68, 0.25)');
      renderChannelCurve(histData.g, '#10b981', 'rgba(16, 185, 129, 0.25)');
      renderChannelCurve(histData.b, '#3b82f6', 'rgba(59, 130, 246, 0.25)');
      ctx.globalCompositeOperation = 'source-over';
    }

    if (mode === 'all' || mode === 'y') {
      renderChannelCurve(histData.y, '#f59e0b', 'rgba(245, 158, 11, 0.2)');
    }
  };

  /**
   * Ekualisasi Histogram (Histogram Equalization) berbasis CDF Luminansi Y
   * Meratakan kontras citra gelap/terang secara adaptif matematis
   */
  FiltersConvolution.applyHistogramEqualization = function (imageData) {
    const data = imageData.data;
    const len = data.length;
    const totalPixels = imageData.width * imageData.height;

    // 1. Hitung histogram luminansi Y
    const yHist = new Uint32Array(256);
    for (let i = 0; i < len; i += 4) {
      const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      yHist[y]++;
    }

    // 2. Hitung Cumulative Distribution Function (CDF)
    const cdf = new Float64Array(256);
    let cumulative = 0;
    let cdfMin = 0;
    let foundMin = false;

    for (let i = 0; i < 256; i++) {
      cumulative += yHist[i];
      cdf[i] = cumulative;
      if (!foundMin && cumulative > 0) {
        cdfMin = cumulative;
        foundMin = true;
      }
    }

    // 3. Buat Lookup Table pemetaan: T(k) = round( (CDF(k) - CDF_min) / (N - CDF_min) * 255 )
    const lut = new Uint8Array(256);
    const denominator = totalPixels - cdfMin || 1;

    for (let i = 0; i < 256; i++) {
      lut[i] = Math.round(clamp(((cdf[i] - cdfMin) / denominator) * 255));
    }

    // 4. Petakan piksel RGB dengan rasio luminansi baru
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const yOld = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const yNew = lut[yOld];

      if (yOld === 0) {
        data[i] = yNew;
        data[i + 1] = yNew;
        data[i + 2] = yNew;
      } else {
        const ratio = yNew / yOld;
        data[i] = clamp(Math.round(r * ratio));
        data[i + 1] = clamp(Math.round(g * ratio));
        data[i + 2] = clamp(Math.round(b * ratio));
      }
    }

    return imageData;
  };

  /**
   * Peregangan Kontras Otomatis (Contrast Stretching / Auto Levels)
   * Membentangkan rentang nilai [min, max] ke rentang penuh [0, 255]
   */
  FiltersConvolution.applyContrastStretching = function (imageData) {
    const data = imageData.data;
    const len = data.length;

    let minR = 255, maxR = 0;
    let minG = 255, maxG = 0;
    let minB = 255, maxB = 0;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (g < minG) minG = g;
      if (g > maxG) maxG = g;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }

    const rangeR = maxR - minR || 1;
    const rangeG = maxG - minG || 1;
    const rangeB = maxB - minB || 1;

    for (let i = 0; i < len; i += 4) {
      data[i] = clamp(Math.round(((data[i] - minR) / rangeR) * 255));
      data[i + 1] = clamp(Math.round(((data[i + 1] - minG) / rangeG) * 255));
      data[i + 2] = clamp(Math.round(((data[i + 2] - minB) / rangeB) * 255));
    }

    return imageData;
  };

  // ==========================================
  // 2. Konvolusi Spasial 2D (Spatial Convolution)
  // ==========================================

  /**
   * Mesin Konvolusi Spasial 3x3 generik pada ImageData
   * @param {ImageData} srcImageData
   * @param {Array<number>} kernel - Matriks 3x3 datar (9 elemen)
   * @param {number} divisor - Pembagi (normalisasi bobot)
   * @param {number} bias - Nilai offset (misal +128 untuk emboss)
   */
  FiltersConvolution.convolve3x3 = function (srcImageData, kernel, divisor = 1, bias = 0) {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const srcData = srcImageData.data;

    const dstImageData = new ImageData(w, h);
    const dstData = dstImageData.data;

    const div = divisor || 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rAcc = 0;
        let gAcc = 0;
        let bAcc = 0;

        let kIdx = 0;
        for (let ky = -1; ky <= 1; ky++) {
          const sy = Math.max(0, Math.min(h - 1, y + ky));
          const rowOffset = sy * w * 4;

          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.max(0, Math.min(w - 1, x + kx));
            const pIdx = rowOffset + sx * 4;
            const weight = kernel[kIdx++];

            rAcc += srcData[pIdx] * weight;
            gAcc += srcData[pIdx + 1] * weight;
            bAcc += srcData[pIdx + 2] * weight;
          }
        }

        const dstIdx = (y * w + x) * 4;
        dstData[dstIdx] = clamp(Math.round(rAcc / div + bias));
        dstData[dstIdx + 1] = clamp(Math.round(gAcc / div + bias));
        dstData[dstIdx + 2] = clamp(Math.round(bAcc / div + bias));
        dstData[dstIdx + 3] = srcData[dstIdx + 3]; // Preserve alpha
      }
    }

    return dstImageData;
  };

  // Preset Kernel Konvolusi Populer
  FiltersConvolution.KERNELS = {
    gaussianBlur: {
      name: 'Gaussian Blur (Halus 3x3)',
      weights: [1, 2, 1, 2, 4, 2, 1, 2, 1],
      divisor: 16,
      bias: 0
    },
    boxBlur: {
      name: 'Box Blur (Rata-rata 3x3)',
      weights: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      divisor: 9,
      bias: 0
    },
    sharpen: {
      name: 'Penajaman Citra (Sharpen)',
      weights: [0, -1, 0, -1, 5, -1, 0, -1, 0],
      divisor: 1,
      bias: 0
    },
    emboss: {
      name: 'Efek Relief (Emboss 3D)',
      weights: [-2, -1, 0, -1, 1, 1, 0, 1, 2],
      divisor: 1,
      bias: 128
    },
    laplacian: {
      name: 'Laplacian Edge Detector',
      weights: [0, 1, 0, 1, -4, 1, 0, 1, 0],
      divisor: 1,
      bias: 0
    }
  };

  /**
   * Deteksi Tepi Sobel (Magnitude sqrt(Gx^2 + Gy^2))
   */
  FiltersConvolution.applySobelEdge = function (srcImageData) {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const srcData = srcImageData.data;

    const dstImageData = new ImageData(w, h);
    const dstData = dstImageData.data;

    const gxKernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gyKernel = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let gx = 0;
        let gy = 0;

        let kIdx = 0;
        for (let ky = -1; ky <= 1; ky++) {
          const sy = Math.max(0, Math.min(h - 1, y + ky));
          const rowOffset = sy * w * 4;

          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.max(0, Math.min(w - 1, x + kx));
            const pIdx = rowOffset + sx * 4;

            // Gunakan nilai luminansi grayscale piksel tetangga
            const lum = 0.299 * srcData[pIdx] + 0.587 * srcData[pIdx + 1] + 0.114 * srcData[pIdx + 2];

            gx += lum * gxKernel[kIdx];
            gy += lum * gyKernel[kIdx];
            kIdx++;
          }
        }

        const mag = clamp(Math.round(Math.sqrt(gx * gx + gy * gy)));
        const dstIdx = (y * w + x) * 4;

        dstData[dstIdx] = mag;
        dstData[dstIdx + 1] = mag;
        dstData[dstIdx + 2] = mag;
        dstData[dstIdx + 3] = 255;
      }
    }

    return dstImageData;
  };

  // ==========================================
  // 3. Preset Filter Estetik & Sinematik
  // ==========================================

  /**
   * Terapkan preset visual warna ke ImageData:
   * 'sepia' | 'cyberpunk' | 'vintage' | 'emerald'
   */
  FiltersConvolution.applyPresetFilter = function (imageData, presetName) {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      switch (presetName) {
        case 'sepia': {
          data[i] = clamp(Math.round(0.393 * r + 0.769 * g + 0.189 * b));
          data[i + 1] = clamp(Math.round(0.349 * r + 0.686 * g + 0.168 * b));
          data[i + 2] = clamp(Math.round(0.272 * r + 0.534 * g + 0.131 * b));
          break;
        }
        case 'cyberpunk': {
          // Teal shadows & orange highlights
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < 128) {
            data[i] = clamp(Math.round(r * 0.7));
            data[i + 1] = clamp(Math.round(g * 1.1 + 15));
            data[i + 2] = clamp(Math.round(b * 1.3 + 30));
          } else {
            data[i] = clamp(Math.round(r * 1.3 + 25));
            data[i + 1] = clamp(Math.round(g * 1.0 + 10));
            data[i + 2] = clamp(Math.round(b * 0.7));
          }
          break;
        }
        case 'vintage': {
          // Faded blacks & warm film tone
          data[i] = clamp(Math.round(r * 0.9 + 25));
          data[i + 1] = clamp(Math.round(g * 0.85 + 20));
          data[i + 2] = clamp(Math.round(b * 0.75 + 10));
          break;
        }
        case 'emerald': {
          // Lush forest green vibrancy
          data[i] = clamp(Math.round(r * 0.8));
          data[i + 1] = clamp(Math.round(g * 1.25 + 10));
          data[i + 2] = clamp(Math.round(b * 0.9));
          break;
        }
        case 'noir': {
          const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          const contrast = (lum - 128) * 1.35 + 128;
          const mono = clamp(Math.round(contrast));
          data[i] = mono;
          data[i + 1] = mono;
          data[i + 2] = mono;
          break;
        }
        case 'sunset': {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          data[i] = clamp(Math.round(r * 1.18 + 18));
          data[i + 1] = clamp(Math.round(g * 0.92 + 8));
          data[i + 2] = clamp(Math.round(b * 0.72 + (lum < 90 ? 4 : 0)));
          break;
        }
        case 'arctic': {
          data[i] = clamp(Math.round(r * 0.82 - 4));
          data[i + 1] = clamp(Math.round(g * 1.05 + 12));
          data[i + 2] = clamp(Math.round(b * 1.24 + 22));
          break;
        }
        case 'vivid': {
          const avg = (r + g + b) / 3;
          data[i] = clamp(Math.round(avg + (r - avg) * 1.45));
          data[i + 1] = clamp(Math.round(avg + (g - avg) * 1.45));
          data[i + 2] = clamp(Math.round(avg + (b - avg) * 1.45));
          break;
        }
      }
    }

    return imageData;
  }; 

  /**
   * Creative Lab: gabungan efek suhu warna, vignette radial, grain film,
   * posterisasi, dan transparansi film fade.
   */
  FiltersConvolution.applyCreativeLab = function (imageData, options = {}) {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxDistance = Math.sqrt(cx * cx + cy * cy);

    const temperature = Number(options.temperature || 0);
    const vignette = Math.max(0, Math.min(100, Number(options.vignette || 0))) / 100;
    const grain = Math.max(0, Math.min(100, Number(options.grain || 0))) / 100;
    const levels = Math.max(2, Math.min(32, Number(options.posterize || 32)));
    const fade = Math.max(0, Math.min(100, Number(options.fade || 0))) / 100;
    const step = 255 / (levels - 1);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        r = clamp(r + temperature * 0.4);
        g = clamp(g + temperature * 0.05);
        b = clamp(b - temperature * 0.4);

        if (levels < 32) {
          r = clamp(Math.round(Math.round(r / step) * step));
          g = clamp(Math.round(Math.round(g / step) * step));
          b = clamp(Math.round(Math.round(b / step) * step));
        }

        if (vignette > 0) {
          const dx = (x - cx) / cx;
          const dy = (y - cy) / cy;
          const normalized = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 1.25);
          const falloff = normalized * normalized * vignette;
          r = clamp(r * (1 - falloff * 0.85));
          g = clamp(g * (1 - falloff * 0.85));
          b = clamp(b * (1 - falloff * 0.85));
        }

        if (fade > 0) {
          r = clamp(r * (1 - fade * 0.18) + 242 * fade * 0.18);
          g = clamp(g * (1 - fade * 0.18) + 237 * fade * 0.18);
          b = clamp(b * (1 - fade * 0.18) + 220 * fade * 0.18);
        }

        if (grain > 0) {
          const hash = ((x * 374761393 + y * 668265263) ^ (x * y * 127)) >>> 0;
          const noise = ((hash % 2001) / 1000 - 1) * 18 * grain;
          r = clamp(r + noise);
          g = clamp(g + noise);
          b = clamp(b + noise);
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }

    return imageData;
  };

  // ==========================================
  // 4. Sensor Pikselasi Privasi (Redaction Tool)
  // ==========================================

  FiltersConvolution.applyPrivacyPixelate = function (imageData, boxX, boxY, boxW, boxH, blockSize = 12) {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;

    const startX = Math.max(0, Math.min(w - 1, boxX));
    const startY = Math.max(0, Math.min(h - 1, boxY));
    const endX = Math.max(0, Math.min(w, boxX + boxW));
    const endY = Math.max(0, Math.min(h, boxY + boxH));

    for (let y = startY; y < endY; y += blockSize) {
      for (let x = startX; x < endX; x += blockSize) {
        const curBlockW = Math.min(blockSize, endX - x);
        const curBlockH = Math.min(blockSize, endY - y);
        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        for (let by = 0; by < curBlockH; by++) {
          for (let bx = 0; bx < curBlockW; bx++) {
            const idx = ((y + by) * w + (x + bx)) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
          }
        }

        const avgR = Math.round(sumR / count);
        const avgG = Math.round(sumG / count);
        const avgB = Math.round(sumB / count);

        for (let by = 0; by < curBlockH; by++) {
          for (let bx = 0; bx < curBlockW; bx++) {
            const idx = ((y + by) * w + (x + bx)) * 4;
            data[idx] = avgR;
            data[idx + 1] = avgG;
            data[idx + 2] = avgB;
          }
        }
      }
    }

    return imageData;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FiltersConvolution;
  } else {
    global.FiltersConvolution = FiltersConvolution;
  }
})(typeof window !== 'undefined' ? window : this);
