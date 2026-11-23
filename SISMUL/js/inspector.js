/**
 * inspector.js
 * Sistem Multimedia - Kelompok 2
 * Implementasi Inspektor Piksel & Analisis Warna:
 * - Magnifying Loupe (Kaca pembesar piksel dengan grid diskrit)
 * - Ekstraksi koordinat (X, Y) dan sampling warna RGBA
 * - Konversi multi-ruang warna (RGB, CMYK, HSI, YIQ, YCbCr)
 * - Tampilan visual per kanal warna
 */

(function (global) {
  'use strict';

  const Inspector = {};

  /**
   * Mengambil informasi lengkap satu piksel pada koordinat (x, y)
   */
  Inspector.inspectPixel = function (canvas, x, y) {
    if (!canvas || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
      return null;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const a = pixel[3];

    // Hitung semua representasi warna
    const hex =
      '#' +
      [r, g, b]
        .map((val) => val.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

    const hsi = global.ColorModels ? global.ColorModels.rgbToHsi(r, g, b) : null;
    const cmyk = global.ColorModels ? global.ColorModels.rgbToCmyk(r, g, b) : null;
    const yiq = global.ColorModels ? global.ColorModels.rgbToYiq(r, g, b) : null;
    const ycbcr = global.ColorModels ? global.ColorModels.rgbToYcbcr(r, g, b) : null;
    const gray = global.ColorModels ? global.ColorModels.rgbToGrayscale(r, g, b) : Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    return {
      coords: { x, y },
      rgba: { r, g, b, a },
      hex: hex,
      grayscale: gray,
      hsi: hsi,
      cmyk: cmyk,
      yiq: yiq,
      ycbcr: ycbcr
    };
  };

  /**
   * Menggambar Magnifying Loupe (pembesar piksel dengan grid) pada target canvas
   * @param {HTMLCanvasElement} srcCanvas - Canvas sumber
   * @param {HTMLCanvasElement} loupeCanvas - Canvas loupe (misal 150x150)
   * @param {number} centerX - Koordinat X piksel fokus
   * @param {number} centerY - Koordinat Y piksel fokus
   * @param {number} sampleRadius - Radius piksel sampel (misal 4 = area 9x9 piksel)
   */
  Inspector.renderLoupe = function (srcCanvas, loupeCanvas, centerX, centerY, sampleRadius = 4) {
    if (!srcCanvas || !loupeCanvas) return;

    const loupeCtx = loupeCanvas.getContext('2d');
    const loupeW = loupeCanvas.width;
    const loupeH = loupeCanvas.height;

    loupeCtx.clearRect(0, 0, loupeW, loupeH);

    const sampleDim = sampleRadius * 2 + 1; // 9x9 jika radius 4
    const cellW = loupeW / sampleDim;
    const cellH = loupeH / sampleDim;

    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });

    // Dapatkan data piksel sekitar
    const startX = centerX - sampleRadius;
    const startY = centerY - sampleRadius;

    for (let sy = 0; sy < sampleDim; sy++) {
      for (let sx = 0; sx < sampleDim; sx++) {
        const curX = startX + sx;
        const curY = startY + sy;

        const cellPosX = sx * cellW;
        const cellPosY = sy * cellH;

        if (curX < 0 || curY < 0 || curX >= srcCanvas.width || curY >= srcCanvas.height) {
          // Di luar batas kanvas: checkerboard transparansi
          loupeCtx.fillStyle = (sx + sy) % 2 === 0 ? '#1e222d' : '#2a2f3d';
          loupeCtx.fillRect(cellPosX, cellPosY, cellW, cellH);
        } else {
          const pixel = srcCtx.getImageData(curX, curY, 1, 1).data;
          loupeCtx.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
          loupeCtx.fillRect(cellPosX, cellPosY, cellW, cellH);
        }

        // Garis grid diskrit
        loupeCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        loupeCtx.lineWidth = 1;
        loupeCtx.strokeRect(cellPosX, cellPosY, cellW, cellH);
      }
    }

    // Sorot piksel target tengah (reticle)
    const midX = sampleRadius * cellW;
    const midY = sampleRadius * cellH;

    loupeCtx.strokeStyle = '#38bdf8'; // Cyan accent
    loupeCtx.lineWidth = 2.5;
    loupeCtx.strokeRect(midX, midY, cellW, cellH);

    // Titik tengah crosshair kecil
    loupeCtx.fillStyle = '#ffffff';
    loupeCtx.beginPath();
    loupeCtx.arc(midX + cellW / 2, midY + cellH / 2, 2, 0, Math.PI * 2);
    loupeCtx.fill();
  };

  // Export module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Inspector;
  } else {
    global.Inspector = Inspector;
  }
})(typeof window !== 'undefined' ? window : this);
