/**
 * transformations.js
 * Sistem Multimedia - Kelompok 2
 * Implementasi transformasi geometri dan akuisisi citra:
 * - Resize dengan manual Nearest Neighbor & Bilinear Interpolation
 * - Flip Horizontal dan Flip Vertical
 * - Rotate (90 CW, 90 CCW, 180, dan Arbitrary Angle)
 * - Crop area dengan bounding box
 */

(function (global) {
  'use strict';

  const Transformations = {};

  // ==========================================
  // 1. Resize dengan Interpolasi Manual
  // ==========================================

  /**
   * Resize dengan Nearest Neighbor Interpolation (manual pixel mapping)
   * Cocok untuk pixel art / pemahaman sampling diskrit
   */
  Transformations.resizeNearestNeighbor = function (srcImageData, dstWidth, dstHeight) {
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;
    const srcData = srcImageData.data;

    const dstImageData = new ImageData(dstWidth, dstHeight);
    const dstData = dstImageData.data;

    const xRatio = srcW / dstWidth;
    const yRatio = srcH / dstHeight;

    for (let dy = 0; dy < dstHeight; dy++) {
      const sy = Math.min(srcH - 1, Math.floor(dy * yRatio));
      const srcRowOffset = sy * srcW * 4;
      const dstRowOffset = dy * dstWidth * 4;

      for (let dx = 0; dx < dstWidth; dx++) {
        const sx = Math.min(srcW - 1, Math.floor(dx * xRatio));
        const srcIdx = srcRowOffset + sx * 4;
        const dstIdx = dstRowOffset + dx * 4;

        dstData[dstIdx] = srcData[srcIdx];         // R
        dstData[dstIdx + 1] = srcData[srcIdx + 1]; // G
        dstData[dstIdx + 2] = srcData[srcIdx + 2]; // B
        dstData[dstIdx + 3] = srcData[srcIdx + 3]; // A
      }
    }

    return dstImageData;
  };

  /**
   * Resize dengan Bilinear Interpolation (manual 4-neighbor weighted average)
   * Memberikan hasil sampling yang halus dan mengurangi jaggies
   */
  Transformations.resizeBilinear = function (srcImageData, dstWidth, dstHeight) {
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;
    const srcData = srcImageData.data;

    const dstImageData = new ImageData(dstWidth, dstHeight);
    const dstData = dstImageData.data;

    const xRatio = srcW / dstWidth;
    const yRatio = srcH / dstHeight;

    for (let dy = 0; dy < dstHeight; dy++) {
      // Map pusat piksel tujuan ke koordinat sumber kontinu
      const sy = (dy + 0.5) * yRatio - 0.5;
      const y1 = Math.max(0, Math.min(srcH - 1, Math.floor(sy)));
      const y2 = Math.max(0, Math.min(srcH - 1, y1 + 1));
      const dyWeight = Math.max(0, Math.min(1, sy - y1));
      const oneMinusDy = 1 - dyWeight;

      const y1Offset = y1 * srcW * 4;
      const y2Offset = y2 * srcW * 4;
      const dstRowOffset = dy * dstWidth * 4;

      for (let dx = 0; dx < dstWidth; dx++) {
        const sx = (dx + 0.5) * xRatio - 0.5;
        const x1 = Math.max(0, Math.min(srcW - 1, Math.floor(sx)));
        const x2 = Math.max(0, Math.min(srcW - 1, x1 + 1));
        const dxWeight = Math.max(0, Math.min(1, sx - x1));
        const oneMinusDx = 1 - dxWeight;

        // 4 tetangga: top-left (p11), top-right (p21), bottom-left (p12), bottom-right (p22)
        const idx11 = y1Offset + x1 * 4;
        const idx21 = y1Offset + x2 * 4;
        const idx12 = y2Offset + x1 * 4;
        const idx22 = y2Offset + x2 * 4;

        const w11 = oneMinusDx * oneMinusDy;
        const w21 = dxWeight * oneMinusDy;
        const w12 = oneMinusDx * dyWeight;
        const w22 = dxWeight * dyWeight;

        const dstIdx = dstRowOffset + dx * 4;

        // R, G, B, A
        for (let c = 0; c < 4; c++) {
          const val =
            w11 * srcData[idx11 + c] +
            w21 * srcData[idx21 + c] +
            w12 * srcData[idx12 + c] +
            w22 * srcData[idx22 + c];
          dstData[dstIdx + c] = Math.round(val);
        }
      }
    }

    return dstImageData;
  };

  /**
   * Helper resize umum
   * method: 'bilinear' | 'nearest'
   */
  Transformations.resize = function (srcImageData, dstWidth, dstHeight, method = 'bilinear') {
    if (dstWidth <= 0 || dstHeight <= 0) {
      throw new Error('Dimensi tujuan harus lebih besar dari 0');
    }
    if (method === 'nearest') {
      return Transformations.resizeNearestNeighbor(srcImageData, dstWidth, dstHeight);
    }
    return Transformations.resizeBilinear(srcImageData, dstWidth, dstHeight);
  };

  // ==========================================
  // 2. Flip (Horizontal & Vertical)
  // ==========================================

  /**
   * Flip Horizontal: x' = W - 1 - x
   */
  Transformations.flipHorizontal = function (imageData) {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const halfW = Math.floor(w / 2);

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w * 4;
      for (let x = 0; x < halfW; x++) {
        const leftIdx = rowOffset + x * 4;
        const rightIdx = rowOffset + (w - 1 - x) * 4;

        for (let c = 0; c < 4; c++) {
          const tmp = data[leftIdx + c];
          data[leftIdx + c] = data[rightIdx + c];
          data[rightIdx + c] = tmp;
        }
      }
    }
    return imageData;
  };

  /**
   * Flip Vertical: y' = H - 1 - y
   */
  Transformations.flipVertical = function (imageData) {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const halfH = Math.floor(h / 2);

    for (let y = 0; y < halfH; y++) {
      const topRowOffset = y * w * 4;
      const bottomRowOffset = (h - 1 - y) * w * 4;

      for (let x = 0; x < w * 4; x++) {
        const topIdx = topRowOffset + x;
        const bottomIdx = bottomRowOffset + x;

        const tmp = data[topIdx];
        data[topIdx] = data[bottomIdx];
        data[bottomIdx] = tmp;
      }
    }
    return imageData;
  };

  // ==========================================
  // 3. Rotate (90 CW, 90 CCW, 180, Arbitrary)
  // ==========================================

  /**
   * Rotate 90 derajat Clockwise: (x, y) -> (H - 1 - y, x)
   */
  Transformations.rotate90CW = function (srcImageData) {
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;
    const srcData = srcImageData.data;

    const dstW = srcH;
    const dstH = srcW;
    const dstImageData = new ImageData(dstW, dstH);
    const dstData = dstImageData.data;

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = (y * srcW + x) * 4;
        const dx = srcH - 1 - y;
        const dy = x;
        const dstIdx = (dy * dstW + dx) * 4;

        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }

    return dstImageData;
  };

  /**
   * Rotate 90 derajat Counter-Clockwise: (x, y) -> (y, W - 1 - x)
   */
  Transformations.rotate90CCW = function (srcImageData) {
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;
    const srcData = srcImageData.data;

    const dstW = srcH;
    const dstH = srcW;
    const dstImageData = new ImageData(dstW, dstH);
    const dstData = dstImageData.data;

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = (y * srcW + x) * 4;
        const dx = y;
        const dy = srcW - 1 - x;
        const dstIdx = (dy * dstW + dx) * 4;

        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }

    return dstImageData;
  };

  /**
   * Rotate 180 derajat: (x, y) -> (W - 1 - x, H - 1 - y)
   */
  Transformations.rotate180 = function (srcImageData) {
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;
    const srcData = srcImageData.data;

    const dstImageData = new ImageData(srcW, srcH);
    const dstData = dstImageData.data;
    const totalPixels = srcW * srcH;

    for (let i = 0; i < totalPixels; i++) {
      const srcIdx = i * 4;
      const dstIdx = (totalPixels - 1 - i) * 4;

      dstData[dstIdx] = srcData[srcIdx];
      dstData[dstIdx + 1] = srcData[srcIdx + 1];
      dstData[dstIdx + 2] = srcData[srcIdx + 2];
      dstData[dstIdx + 3] = srcData[srcIdx + 3];
    }

    return dstImageData;
  };

  /**
   * Rotasi sudut bebas (degrees) menggunakan canvas 2D matrix
   */
  Transformations.rotateArbitrary = function (srcCanvas, degrees) {
    const rad = (degrees * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));

    const origW = srcCanvas.width;
    const origH = srcCanvas.height;

    // Bounding box baru
    const newW = Math.round(origW * cos + origH * sin);
    const newH = Math.round(origW * sin + origH * cos);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = newW;
    outCanvas.height = newH;
    const ctx = outCanvas.getContext('2d');

    ctx.translate(newW / 2, newH / 2);
    ctx.rotate(rad);
    ctx.drawImage(srcCanvas, -origW / 2, -origH / 2);

    return outCanvas;
  };

  // ==========================================
  // 4. Crop Area
  // ==========================================

  /**
   * Crop area tertentu dari canvas atau ImageData
   */
  Transformations.crop = function (srcCanvas, x, y, width, height) {
    x = Math.max(0, Math.min(srcCanvas.width - 1, Math.round(x)));
    y = Math.max(0, Math.min(srcCanvas.height - 1, Math.round(y)));
    width = Math.max(1, Math.min(srcCanvas.width - x, Math.round(width)));
    height = Math.max(1, Math.min(srcCanvas.height - y, Math.round(height)));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const ctx = outCanvas.getContext('2d');

    ctx.drawImage(srcCanvas, x, y, width, height, 0, 0, width, height);
    return outCanvas;
  };

  // Export module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Transformations;
  } else {
    global.Transformations = Transformations;
  }
})(typeof window !== 'undefined' ? window : this);
