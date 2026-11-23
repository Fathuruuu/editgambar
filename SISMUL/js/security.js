/**
 * security.js
 * Sistem Multimedia - Kelompok 2
 * Implementasi fitur Keamanan & Privasi Citra:
 * - Sanitasi Metadata EXIF (Pembersihan GPS, Perangkat, Timestamp)
 * - Detektor EXIF pada file asli
 * - Watermark Teks Kustom dengan parameter opasitas, posisi, dan rotasi
 */

(function (global) {
  'use strict';

  const Security = {};

  // ==========================================
  // 1. Deteksi dan Sanitasi Metadata EXIF
  // ==========================================

  /**
   * Memeriksa keberadaan segmen EXIF (APP1 0xFFE1) pada file JPEG/TIFF
   * @param {ArrayBuffer} buffer - Buffer file asli
   * @returns {Object} status deteksi EXIF
   */
  Security.detectExif = function (buffer) {
    if (!buffer || buffer.byteLength < 4) {
      return { hasExif: false, details: 'File terlalu kecil atau bukan JPEG' };
    }

    const view = new DataView(buffer);
    // Cek JPEG SOI marker 0xFFD8
    if (view.getUint16(0, false) !== 0xffd8) {
      return {
        hasExif: false,
        isJpeg: false,
        details: 'Bukan file JPEG standard (PNG/WebP tidak menyimpan EXIF JPEG)'
      };
    }

    let offset = 2;
    const length = buffer.byteLength;
    let foundApp1 = false;
    let exifSize = 0;

    while (offset < length - 4) {
      const marker = view.getUint16(offset, false);
      offset += 2;

      // APP1 Marker: 0xFFE1 biasanya berisi EXIF data
      if (marker === 0xffe1) {
        foundApp1 = true;
        const segmentLength = view.getUint16(offset, false);
        exifSize = segmentLength;

        // Cek header "Exif\0\0" (0x457869660000)
        if (offset + 6 <= length) {
          const header =
            String.fromCharCode(view.getUint8(offset + 2)) +
            String.fromCharCode(view.getUint8(offset + 3)) +
            String.fromCharCode(view.getUint8(offset + 4)) +
            String.fromCharCode(view.getUint8(offset + 5));

          if (header === 'Exif') {
            return {
              hasExif: true,
              isJpeg: true,
              exifSize: exifSize,
              details: `Segmen EXIF APP1 ditemukan (${exifSize} byte). Berisi potensi koordinat GPS, informasi kamera/HP, & tanggal pemotretan.`
            };
          }
        }
        break;
      } else if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) {
        // Stop jika bukan marker atau sudah masuk Start of Scan (SOS)
        break;
      } else {
        const segLen = view.getUint16(offset, false);
        offset += segLen;
      }
    }

    return {
      hasExif: false,
      isJpeg: true,
      details: 'Tidak ditemukan segmen EXIF APP1 pada file JPEG ini.'
    };
  };

  /**
   * Menjelaskan mekanisme keamanan sanitasi canvas
   */
  Security.getSanitizationInfo = function () {
    return {
      mechanism: 'Canvas Re-encoding Sanitization',
      description:
        'Saat citra didekode ke kanvas HTML5, browser hanya membaca data piksel RGB murni. Semua blok metadata EXIF, GPS tag, informasi lensa, dan thumbnail rahasia terlepas secara otomatis dan tidak tersimpan saat diekspor.',
      safetyLevel: '100% Aman (Client-Side Zero-Leak)'
    };
  };

  // ==========================================
  // 2. Watermark Teks Kustom
  // ==========================================

  /**
   * Menerapkan watermark teks pada canvas
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   *   text: string
   *   position: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'tile'
   *   fontSize: number
   *   fontFamily: string
   *   color: string (hex/rgba)
   *   opacity: number (0..1)
   *   rotation: number (derajat)
   *   badge: boolean (tampilkan latar pill)
   */
  Security.applyTextWatermark = function (canvas, options = {}) {
    const {
      text = 'CONFIDENTIAL / DOKUMEN RAHASIA',
      position = 'bottom-right',
      fontSize = 28,
      fontFamily = 'system-ui, sans-serif',
      color = '#ffffff',
      opacity = 0.8,
      rotation = 0,
      badge = true
    } = options;

    if (!text || text.trim() === '') return canvas;

    const ctx = canvas.getContext('2d');
    ctx.save();

    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2;

    const padX = fontSize * 0.5;
    const padY = fontSize * 0.3;
    const boxW = textWidth + padX * 2;
    const boxH = textHeight + padY;

    const margin = 24;
    const w = canvas.width;
    const h = canvas.height;

    if (position === 'tile') {
      // Repeated diagonal tile pattern
      ctx.globalAlpha = opacity * 0.4;
      ctx.fillStyle = color;
      const stepX = boxW * 1.8;
      const stepY = boxH * 3.0;

      for (let y = -h; y < h * 2; y += stepY) {
        for (let x = -w; x < w * 2; x += stepX) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((-30 * Math.PI) / 180);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      }
    } else {
      // Hitung koordinat pusat teks
      let cx = w / 2;
      let cy = h / 2;

      switch (position) {
        case 'top-left':
          cx = margin + boxW / 2;
          cy = margin + boxH / 2;
          break;
        case 'top-right':
          cx = w - margin - boxW / 2;
          cy = margin + boxH / 2;
          break;
        case 'bottom-left':
          cx = margin + boxW / 2;
          cy = h - margin - boxH / 2;
          break;
        case 'bottom-right':
          cx = w - margin - boxW / 2;
          cy = h - margin - boxH / 2;
          break;
        case 'center':
        default:
          cx = w / 2;
          cy = h / 2;
          break;
      }

      ctx.translate(cx, cy);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }

      ctx.globalAlpha = opacity;

      // Gambar background badge jika diaktifkan
      if (badge) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        const radius = 6;
        const bx = -boxW / 2;
        const by = -boxH / 2;

        ctx.beginPath();
        ctx.moveTo(bx + radius, by);
        ctx.lineTo(bx + boxW - radius, by);
        ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + radius);
        ctx.lineTo(bx + boxW, by + boxH - radius);
        ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - radius, by + boxH);
        ctx.lineTo(bx + radius, by + boxH);
        ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - radius);
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + radius, by);
        ctx.closePath();
        ctx.fill();
      }

      // Gambar teks watermark dengan subtle shadow
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(text, 0, 0);
    }

    ctx.restore();
    return canvas;
  };

  // Export module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Security;
  } else {
    global.Security = Security;
  }
})(typeof window !== 'undefined' ? window : this);
