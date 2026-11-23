/**
 * compression.js
 * Sistem Multimedia - Kelompok 2
 * Implementasi modul kompresi dan metrik multimedia:
 * - Chroma Subsampling (4:4:4, 4:2:2, 4:2:0) dengan perataan blok Cb & Cr
 * - Perhitungan Ukuran Mentah (Raw Uncompressed: W x H x 3 byte)
 * - Ekspor format JPEG, WebP, PNG dengan parameter kualitas
 * - Perhitungan PSNR (Peak Signal-to-Noise Ratio) & MSE
 * - Rasio kompresi & waktu proses
 */

(function (global) {
  'use strict';

  const Compression = {};

  // ==========================================
  // 1. Chroma Subsampling (4:4:4, 4:2:2, 4:2:0)
  // ==========================================

  /**
   * Terapkan Chroma Subsampling pada ImageData:
   * 1. Konversi piksel RGB ke YCbCr
   * 2. Rata-ratakan komponen Cb dan Cr sesuai mode:
   *    - '4:4:4': Tanpa subsampling (100% Cb, 100% Cr)
   *    - '4:2:2': Subsampling horizontal 2x1 (50% chroma horizontal)
   *    - '4:2:0': Subsampling blok 2x2 (50% horizontal & 50% vertikal = 25% chroma)
   * 3. Konversi kembali dari YCbCr ke RGB untuk preview visual
   */
  Compression.applyChromaSubsampling = function (imageData, mode = '4:2:0') {
    if (mode === '4:4:4') {
      return imageData; // Tidak ada subsampling
    }

    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const totalPixels = w * h;

    // Buffer sementara untuk Y, Cb, Cr
    const yArr = new Float32Array(totalPixels);
    const cbArr = new Float32Array(totalPixels);
    const crArr = new Float32Array(totalPixels);

    // Langkah 1: RGB -> YCbCr
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      yArr[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      cbArr[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      crArr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    }

    // Langkah 2: Rata-ratakan Cb dan Cr
    if (mode === '4:2:2') {
      // Subsampling 2x1 horizontal: rata-rata per 2 piksel sebaris
      for (let y = 0; y < h; y++) {
        const rowOffset = y * w;
        for (let x = 0; x < w; x += 2) {
          const idx1 = rowOffset + x;
          const idx2 = x + 1 < w ? rowOffset + x + 1 : idx1;

          const avgCb = (cbArr[idx1] + cbArr[idx2]) / 2;
          const avgCr = (crArr[idx1] + crArr[idx2]) / 2;

          cbArr[idx1] = avgCb;
          cbArr[idx2] = avgCb;
          crArr[idx1] = avgCr;
          crArr[idx2] = avgCr;
        }
      }
    } else if (mode === '4:2:0') {
      // Subsampling 2x2 blok: rata-rata 4 piksel per blok
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const yNext = y + 1 < h ? y + 1 : y;
          const xNext = x + 1 < w ? x + 1 : x;

          const p00 = y * w + x;
          const p10 = y * w + xNext;
          const p01 = yNext * w + x;
          const p11 = yNext * w + xNext;

          const avgCb = (cbArr[p00] + cbArr[p10] + cbArr[p01] + cbArr[p11]) / 4;
          const avgCr = (crArr[p00] + crArr[p10] + crArr[p01] + crArr[p11]) / 4;

          cbArr[p00] = avgCb;
          cbArr[p10] = avgCb;
          cbArr[p01] = avgCb;
          cbArr[p11] = avgCb;

          crArr[p00] = avgCr;
          crArr[p10] = avgCr;
          crArr[p01] = avgCr;
          crArr[p11] = avgCr;
        }
      }
    }

    // Langkah 3: YCbCr -> RGB
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const yVal = yArr[i];
      const cbVal = cbArr[i];
      const crVal = crArr[i];

      const r = yVal + 1.402 * (crVal - 128);
      const g = yVal - 0.344136 * (cbVal - 128) - 0.714136 * (crVal - 128);
      const b = yVal + 1.772 * (cbVal - 128);

      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      // data[idx + 3] alpha tetap
    }

    return imageData;
  };

  // ==========================================
  // 2. Metrik Multimedia: PSNR, MSE, Raw Size
  // ==========================================

  /**
   * Menghitung Ukuran Mentah Uncompressed: Lebar x Tinggi x 3 Byte (RGB 24-bit)
   */
  Compression.calculateRawSize = function (width, height) {
    const bytes = width * height * 3;
    return {
      bytes: bytes,
      formatted: Compression.formatBytes(bytes)
    };
  };

  /**
   * Format ukuran byte ke string terbaca (B, KB, MB)
   */
  Compression.formatBytes = function (bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);
    return `${val} ${sizes[i]}`;
  };

  /**
   * Menghitung MSE (Mean Squared Error) dan PSNR (Peak Signal-to-Noise Ratio)
   * antara dua ImageData dengan ukuran yang sama.
   *
   * MSE = 1 / (3 * W * H) * SUM( (R - R')^2 + (G - G')^2 + (B - B')^2 )
   * PSNR = 10 * log10( 255^2 / MSE )
   */
  Compression.calculatePSNR = function (origImageData, processedImageData) {
    if (
      origImageData.width !== processedImageData.width ||
      origImageData.height !== processedImageData.height
    ) {
      return {
        mse: null,
        psnr: null,
        error: 'Dimensi gambar berbeda, PSNR hanya dihitung pada dimensi sama'
      };
    }

    const d1 = origImageData.data;
    const d2 = processedImageData.data;
    const totalPixels = origImageData.width * origImageData.height;
    let sumSquaredDiff = 0;

    for (let i = 0; i < totalPixels * 4; i += 4) {
      const dr = d1[i] - d2[i];
      const dg = d1[i + 1] - d2[i + 1];
      const db = d1[i + 2] - d2[i + 2];
      sumSquaredDiff += dr * dr + dg * dg + db * db;
    }

    const mse = sumSquaredDiff / (3 * totalPixels);

    if (mse === 0) {
      return {
        mse: 0,
        psnr: Infinity,
        psnrString: '∞ (Identik)',
        quality: 'Sempurna (Lossless)'
      };
    }

    const psnr = 10 * Math.log10((255 * 255) / mse);
    let quality = 'Rendah';
    if (psnr >= 40) quality = 'Sangat Tinggi (Hampir Sempurna)';
    else if (psnr >= 35) quality = 'Tinggi';
    else if (psnr >= 30) quality = 'Bagus (Standar JPEG)';
    else if (psnr >= 25) quality = 'Sedang (Artefak Terlihat)';

    return {
      mse: Math.round(mse * 100) / 100,
      psnr: Math.round(psnr * 100) / 100,
      psnrString: `${(Math.round(psnr * 100) / 100).toFixed(2)} dB`,
      quality: quality
    };
  };

  /**
   * Menghitung Rasio Kompresi
   */
  Compression.calculateCompressionMetrics = function (originalBytes, compressedBytes, rawBytes) {
    const origRatio = originalBytes > 0 ? (originalBytes / compressedBytes).toFixed(2) : '1.00';
    const origSavings =
      originalBytes > 0
        ? (((originalBytes - compressedBytes) / originalBytes) * 100).toFixed(1)
        : '0.0';

    const rawRatio = rawBytes > 0 ? (rawBytes / compressedBytes).toFixed(2) : '1.00';
    const rawSavings =
      rawBytes > 0
        ? (((rawBytes - compressedBytes) / rawBytes) * 100).toFixed(1)
        : '0.0';

    return {
      originalBytes,
      compressedBytes,
      rawBytes,
      ratioVsOriginal: `${origRatio}:1`,
      savingsVsOriginal: `${origSavings}%`,
      ratioVsRaw: `${rawRatio}:1`,
      savingsVsRaw: `${rawSavings}%`
    };
  };

  // ==========================================
  // 3. Ekspor Kanvas ke Blob (JPEG / WebP / PNG)
  // ==========================================

  /**
   * Ekspor kanvas ke Blob dengan mimeType dan kualitas
   * Mengembalikan Promise<{ blob, size, url, mimeType }>
   */
  Compression.exportCanvas = function (canvas, format = 'image/jpeg', quality = 0.85) {
    return new Promise((resolve, reject) => {
      try {
        const mime =
          format === 'png' || format === 'image/png'
            ? 'image/png'
            : format === 'webp' || format === 'image/webp'
            ? 'image/webp'
            : 'image/jpeg';

        const q = mime === 'image/png' ? undefined : Math.max(0.01, Math.min(1.0, quality));

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Gagal menghasilkan Blob dari kanvas'));
              return;
            }
            resolve({
              blob: blob,
              size: blob.size,
              formattedSize: Compression.formatBytes(blob.size),
              mimeType: mime,
              url: URL.createObjectURL(blob)
            });
          },
          mime,
          q
        );
      } catch (err) {
        reject(err);
      }
    });
  };

  // Export module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Compression;
  } else {
    global.Compression = Compression;
  }
})(typeof window !== 'undefined' ? window : this);
