/**
 * color-models.js
 * Sistem Multimedia - Kelompok 2
 * Implementasi manual rumus konversi ruang warna dan pengolahan piksel:
 * - RGB <-> HSI (Hue, Saturation, Intensity)
 * - RGB -> CMYK (Cyan, Magenta, Yellow, Key/Black)
 * - RGB -> YIQ (NTSC Color System)
 * - RGB <-> YCbCr (ITU-R BT.601)
 * - Grayscale (Y = 0.299R + 0.587G + 0.114B)
 * - Invert, Brightness, Contrast
 * - Bit Depth Reduction (Kuantisasi ulang per kanal)
 * - Channel Split (R, G, B, Luminance Y)
 */

(function (global) {
  'use strict';

  const ColorModels = {};

  // Utility clamp
  function clamp(val, min = 0, max = 255) {
    return Math.max(min, Math.min(max, val));
  }

  ColorModels.clamp = clamp;

  // ==========================================
  // 1. Grayscale, Invert, Brightness, Contrast
  // ==========================================

  /**
   * Mengubah piksel RGB ke Grayscale dengan rumus NTSC:
   * Y = 0.299 * R + 0.587 * G + 0.114 * B
   */
  ColorModels.rgbToGrayscale = function (r, g, b) {
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  };

  /**
   * Terapkan filter Grayscale ke ImageData
   */
  ColorModels.applyGrayscale = function (imageData) {
    const data = imageData.data;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    return imageData;
  };

  /**
   * Invert nilai warna: R' = 255 - R, G' = 255 - G, B' = 255 - B
   */
  ColorModels.applyInvert = function (imageData) {
    const data = imageData.data;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    return imageData;
  };

  /**
   * Brightness adjustment (-255 sampai +255)
   */
  ColorModels.applyBrightness = function (imageData, offset) {
    const data = imageData.data;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      data[i] = clamp(data[i] + offset);
      data[i + 1] = clamp(data[i + 1] + offset);
      data[i + 2] = clamp(data[i + 2] + offset);
    }
    return imageData;
  };

  /**
   * Contrast adjustment (-100 sampai +100)
   * Rumus faktor kontras: F = 259 * (C + 255) / (255 * (259 - C))
   */
  ColorModels.applyContrast = function (imageData, contrast) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const data = imageData.data;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      data[i] = clamp(Math.round(factor * (data[i] - 128) + 128));
      data[i + 1] = clamp(Math.round(factor * (data[i + 1] - 128) + 128));
      data[i + 2] = clamp(Math.round(factor * (data[i + 2] - 128) + 128));
    }
    return imageData;
  };

  // ==========================================
  // 2. RGB <-> HSI (Hue, Saturation, Intensity)
  // ==========================================

  /**
   * Konversi RGB (0..255) ke HSI
   * Output: { h: [0..360), s: [0..1], i: [0..1], i255: [0..255] }
   */
  ColorModels.rgbToHsi = function (r, g, b) {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const intensity = (rNorm + gNorm + bNorm) / 3;

    if (intensity === 0) {
      return { h: 0, s: 0, i: 0, i255: 0 };
    }

    const minVal = Math.min(rNorm, gNorm, bNorm);
    const sum = rNorm + gNorm + bNorm;
    let saturation = sum === 0 ? 0 : 1 - (3 * minVal) / sum;
    saturation = Math.max(0, Math.min(1, saturation));

    // Hue calculation
    const num = 0.5 * ((rNorm - gNorm) + (rNorm - bNorm));
    const den = Math.sqrt((rNorm - gNorm) * (rNorm - gNorm) + (rNorm - bNorm) * (gNorm - bNorm));

    let hue = 0;
    if (den !== 0) {
      let theta = Math.acos(clamp(num / den, -1, 1)) * (180 / Math.PI);
      hue = bNorm <= gNorm ? theta : 360 - theta;
    }

    if (isNaN(hue)) hue = 0;

    return {
      h: Math.round(hue * 10) / 10,
      s: Math.round(saturation * 1000) / 1000,
      i: Math.round(intensity * 1000) / 1000,
      i255: Math.round(intensity * 255)
    };
  };

  /**
   * Konversi HSI ke RGB (0..255)
   * Input: h [0..360), s [0..1], i [0..1]
   */
  ColorModels.hsiToRgb = function (h, s, i) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    i = Math.max(0, Math.min(1, i));

    if (s === 0) {
      const val = Math.round(clamp(i * 255));
      return { r: val, g: val, b: val };
    }

    let r, g, b;

    if (h < 120) {
      // Sector 1: Red-Green sector
      const rad = (h * Math.PI) / 180;
      b = i * (1 - s);
      r = i * (1 + (s * Math.cos(rad)) / Math.cos((Math.PI / 3) - rad));
      g = 3 * i - (r + b);
    } else if (h < 240) {
      // Sector 2: Green-Blue sector
      const hSub = h - 120;
      const rad = (hSub * Math.PI) / 180;
      r = i * (1 - s);
      g = i * (1 + (s * Math.cos(rad)) / Math.cos((Math.PI / 3) - rad));
      b = 3 * i - (r + g);
    } else {
      // Sector 3: Blue-Red sector
      const hSub = h - 240;
      const rad = (hSub * Math.PI) / 180;
      g = i * (1 - s);
      b = i * (1 + (s * Math.cos(rad)) / Math.cos((Math.PI / 3) - rad));
      r = 3 * i - (g + b);
    }

    return {
      r: Math.round(clamp(r * 255)),
      g: Math.round(clamp(g * 255)),
      b: Math.round(clamp(b * 255))
    };
  };

  /**
   * Atur Hue Shift (-180..+180) dan Saturation multiplier (0..3) lewat konversi HSI
   */
  ColorModels.applyHueSaturation = function (imageData, hueShift, satScale) {
    const data = imageData.data;
    const len = data.length;

    for (let idx = 0; idx < len; idx += 4) {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const hsi = ColorModels.rgbToHsi(r, g, b);
      const newH = (hsi.h + hueShift + 360) % 360;
      const newS = clamp(hsi.s * satScale, 0, 1);
      const rgb = ColorModels.hsiToRgb(newH, newS, hsi.i);

      data[idx] = rgb.r;
      data[idx + 1] = rgb.g;
      data[idx + 2] = rgb.b;
    }

    return imageData;
  };

  // ==========================================
  // 3. Konversi Ruang Warna Tambahan
  // ==========================================

  /**
   * RGB -> CMYK
   * C, M, Y, K dalam rentang 0..100 (%)
   */
  ColorModels.rgbToCmyk = function (r, g, b) {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const k = 1 - Math.max(rNorm, gNorm, bNorm);
    if (k >= 0.9999) {
      return { c: 0, m: 0, y: 0, k: 100 };
    }

    const c = (1 - rNorm - k) / (1 - k);
    const m = (1 - gNorm - k) / (1 - k);
    const y = (1 - bNorm - k) / (1 - k);

    return {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100)
    };
  };

  /**
   * RGB -> YIQ (NTSC)
   * Y dalam rentang 0..255
   * I dalam rentang -152..152
   * Q dalam rentang -134..134
   */
  ColorModels.rgbToYiq = function (r, g, b) {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const i = 0.596 * r - 0.274 * g - 0.322 * b;
    const q = 0.211 * r - 0.523 * g + 0.312 * b;

    return {
      y: Math.round(y * 10) / 10,
      i: Math.round(i * 10) / 10,
      q: Math.round(q * 10) / 10
    };
  };

  /**
   * RGB -> YCbCr (ITU-R BT.601)
   * Y dalam rentang 16..235 (atau 0..255)
   * Cb, Cr dalam rentang 16..240 (dengan netral di 128)
   */
  ColorModels.rgbToYcbcr = function (r, g, b) {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    return {
      y: Math.round(clamp(y)),
      cb: Math.round(clamp(cb)),
      cr: Math.round(clamp(cr))
    };
  };

  /**
   * YCbCr -> RGB
   */
  ColorModels.ycbcrToRgb = function (y, cb, cr) {
    const r = y + 1.402 * (cr - 128);
    const g = y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128);
    const b = y + 1.772 * (cb - 128);

    return {
      r: Math.round(clamp(r)),
      g: Math.round(clamp(g)),
      b: Math.round(clamp(b))
    };
  };

  // ==========================================
  // 4. Kuantisasi Kedalaman Bit (Bit Depth)
  // ==========================================

  /**
   * Kuantisasi nilai 0..255 ke kedalaman bit target (1 sampai 8 bit)
   * Rumus:
   * levels = 2^bits
   * step = 255 / (levels - 1)
   * val' = Math.round(Math.round(val / 255 * (levels - 1)) * step)
   */
  ColorModels.quantizeValue = function (val, bits) {
    if (bits >= 8) return val;
    if (bits <= 1) {
      return val >= 128 ? 255 : 0;
    }
    const levels = Math.pow(2, bits);
    const maxLevel = levels - 1;
    const step = 255 / maxLevel;
    const quantizedLevel = Math.round((val / 255) * maxLevel);
    return Math.round(quantizedLevel * step);
  };

  /**
   * Terapkan pengurangan kedalaman bit ke ImageData
   */
  ColorModels.applyBitDepthReduction = function (imageData, bits) {
    if (bits >= 8) return imageData;
    const data = imageData.data;
    const len = data.length;

    // Buat lookup table untuk 256 nilai agar cepat
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = ColorModels.quantizeValue(i, bits);
    }

    for (let i = 0; i < len; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
    return imageData;
  };

  // ==========================================
  // 5. Tampilan Per Kanal (Channel Split)
  // ==========================================

  /**
   * Ekstraksi kanal:
   * mode: 'all' | 'red' | 'green' | 'blue' | 'red-mono' | 'green-mono' | 'blue-mono' | 'y-luminance'
   */
  ColorModels.extractChannel = function (imageData, mode) {
    if (mode === 'all') return imageData;
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      switch (mode) {
        case 'red':
          data[i] = r;
          data[i + 1] = 0;
          data[i + 2] = 0;
          break;
        case 'green':
          data[i] = 0;
          data[i + 1] = g;
          data[i + 2] = 0;
          break;
        case 'blue':
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = b;
          break;
        case 'red-mono':
          data[i] = r;
          data[i + 1] = r;
          data[i + 2] = r;
          break;
        case 'green-mono':
          data[i] = g;
          data[i + 1] = g;
          data[i + 2] = g;
          break;
        case 'blue-mono':
          data[i] = b;
          data[i + 1] = b;
          data[i + 2] = b;
          break;
        case 'y-luminance':
          const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          data[i] = y;
          data[i + 1] = y;
          data[i + 2] = y;
          break;
      }
    }
    return imageData;
  };

  // Export module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorModels;
  } else {
    global.ColorModels = ColorModels;
  }
})(typeof window !== 'undefined' ? window : this);
