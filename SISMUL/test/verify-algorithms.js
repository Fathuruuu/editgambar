/**
 * test/verify-algorithms.js
 * Unit test suite untuk memverifikasi kebenaran rumus Sistem Multimedia:
 * - ColorModels (Grayscale NTSC, HSI, CMYK, YIQ, YCbCr, Quantization)
 * - Transformations (Bilinear, Nearest Neighbor, Flip, Rotate)
 * - Compression (Raw Size, Chroma Subsampling 4:2:2 / 4:2:0, PSNR & MSE)
 * - Security (EXIF APP1 segment detection)
 */

// Polyfill ImageData jika dijalankan di Node/Bun
if (typeof global.ImageData === 'undefined') {
  global.ImageData = class ImageData {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}

const ColorModels = require('../js/color-models.js');
const Transformations = require('../js/transformations.js');
const Compression = require('../js/compression.js');
const Security = require('../js/security.js');

let passCount = 0;
let failCount = 0;

function assert(cond, desc) {
  if (cond) {
    console.log(`  ✓ PASS: ${desc}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failCount++;
  }
}

function assertClose(actual, expected, tol, desc) {
  const diff = Math.abs(actual - expected);
  if (diff <= tol) {
    console.log(`  ✓ PASS: ${desc} (${actual} ≈ ${expected})`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${desc} (actual: ${actual}, expected: ${expected}, diff: ${diff})`);
    failCount++;
  }
}

console.log('=== TEST 1: PENGOLAHAN WARNA (ColorModels) ===');

// 1. Grayscale NTSC: Y = 0.299R + 0.587G + 0.114B
const grayRed = ColorModels.rgbToGrayscale(255, 0, 0);
assert(grayRed === Math.round(0.299 * 255), 'Grayscale Red 100% -> 76');

const grayGreen = ColorModels.rgbToGrayscale(0, 255, 0);
assert(grayGreen === Math.round(0.587 * 255), 'Grayscale Green 100% -> 150');

const grayBlue = ColorModels.rgbToGrayscale(0, 0, 255);
assert(grayBlue === Math.round(0.114 * 255), 'Grayscale Blue 100% -> 29');

// 2. RGB <-> HSI
const hsiRed = ColorModels.rgbToHsi(255, 0, 0);
assertClose(hsiRed.h, 0, 0.5, 'Pure Red HSI Hue = 0 deg');
assertClose(hsiRed.s, 1.0, 0.01, 'Pure Red HSI Saturation = 1.0');
assertClose(hsiRed.i, 1/3, 0.01, 'Pure Red HSI Intensity = 1/3');

const hsiGreen = ColorModels.rgbToHsi(0, 255, 0);
assertClose(hsiGreen.h, 120, 0.5, 'Pure Green HSI Hue = 120 deg');

const hsiBlue = ColorModels.rgbToHsi(0, 0, 255);
assertClose(hsiBlue.h, 240, 0.5, 'Pure Blue HSI Hue = 240 deg');

// Round-trip HSI -> RGB
const reconRed = ColorModels.hsiToRgb(hsiRed.h, hsiRed.s, hsiRed.i);
assert(Math.abs(reconRed.r - 255) <= 2 && reconRed.g <= 2 && reconRed.b <= 2, 'HSI -> RGB Reconstruction Pure Red');

// 3. CMYK
const cmykCyan = ColorModels.rgbToCmyk(0, 255, 255);
assert(cmykCyan.c === 100 && cmykCyan.m === 0 && cmykCyan.y === 0 && cmykCyan.k === 0, 'Pure Cyan CMYK = (100, 0, 0, 0)');

const cmykBlack = ColorModels.rgbToCmyk(0, 0, 0);
assert(cmykBlack.k === 100, 'Black CMYK K = 100%');

// 4. YIQ
const yiq = ColorModels.rgbToYiq(200, 100, 50);
assert(typeof yiq.y === 'number' && typeof yiq.i === 'number' && typeof yiq.q === 'number', 'YIQ output valid numbers');

// 5. YCbCr Round-trip
const ycbcr = ColorModels.rgbToYcbcr(180, 90, 60);
const reconRgb = ColorModels.ycbcrToRgb(ycbcr.y, ycbcr.cb, ycbcr.cr);
assertClose(reconRgb.r, 180, 3, 'YCbCr -> RGB R channel roundtrip');
assertClose(reconRgb.g, 90, 3, 'YCbCr -> RGB G channel roundtrip');
assertClose(reconRgb.b, 60, 3, 'YCbCr -> RGB B channel roundtrip');

// 6. Kuantisasi Kedalaman Bit
assert(ColorModels.quantizeValue(255, 1) === 255, '1-bit quantize 255 -> 255');
assert(ColorModels.quantizeValue(50, 1) === 0, '1-bit quantize 50 -> 0');
assert(ColorModels.quantizeValue(128, 2) === 170 || ColorModels.quantizeValue(128, 2) === 85, '2-bit quantize (4 levels: 0, 85, 170, 255)');
assert(ColorModels.quantizeValue(173, 8) === 173, '8-bit quantize exact preserve');

console.log('\n=== TEST 2: TRANSFORMASI GEOMETRI (Transformations) ===');

// Buat citra uji 4x4
const testImg = new ImageData(4, 4);
for (let i = 0; i < 16; i++) {
  testImg.data[i * 4] = i * 15;     // R
  testImg.data[i * 4 + 1] = 100;     // G
  testImg.data[i * 4 + 2] = 200;     // B
  testImg.data[i * 4 + 3] = 255;     // A
}

// Flip Horizontal
const flippedH = new ImageData(4, 4);
flippedH.data.set(testImg.data);
Transformations.flipHorizontal(flippedH);
assert(flippedH.data[0] === testImg.data[3 * 4], 'Flip Horizontal baris 0: piksel 0 bertukar dengan piksel 3');

// Rotate 90 CW
const rotated90 = Transformations.rotate90CW(testImg);
assert(rotated90.width === 4 && rotated90.height === 4, 'Rotate 90 CW dimensi sesuai');
// (0, 0) pindah ke (3, 0) -> index = (0 * 4 + 3) * 4 = 12
assert(rotated90.data[3 * 4] === testImg.data[0], 'Rotate 90 CW piksel (0,0) berpindah ke (3,0)');

// Bilinear Resize 4x4 -> 8x8
const resizedBilinear = Transformations.resizeBilinear(testImg, 8, 8);
assert(resizedBilinear.width === 8 && resizedBilinear.height === 8, 'Bilinear Resize 4x4 -> 8x8 berhasil');

console.log('\n=== TEST 3: KOMPRESI & METRIK (Compression) ===');

// 1. Raw Size Formula: W x H x 3 Byte
const rawSize = Compression.calculateRawSize(640, 480);
assert(rawSize.bytes === 640 * 480 * 3, 'Raw Size 640x480x3 = 921,600 byte');

// 2. PSNR & MSE Identik
const imgA = new ImageData(10, 10);
const imgB = new ImageData(10, 10);
for (let i = 0; i < 400; i++) {
  imgA.data[i] = 120;
  imgB.data[i] = 120;
}
const psnrIdentical = Compression.calculatePSNR(imgA, imgB);
assert(psnrIdentical.mse === 0, 'MSE citra identik = 0');
assert(psnrIdentical.psnr === Infinity, 'PSNR citra identik = Infinity (Lossless)');

// 3. PSNR dengan Derau Buatan
for (let i = 0; i < 100; i++) {
  // Selisih 10 pada kanal Red
  imgB.data[i * 4] = 130;
}
// dr = 10 -> dr^2 = 100. Di 100 piksel dari 100 total piksel.
// sumSquared = 100 * 100 = 10,000.
// MSE = 10,000 / (3 * 100) = 33.333
// PSNR = 10 * log10( 65025 / 33.333 ) = 10 * log10(1950.75) ≈ 32.90 dB
const psnrNoise = Compression.calculatePSNR(imgA, imgB);
assertClose(psnrNoise.mse, 33.33, 0.5, 'MSE perhitungan derau ≈ 33.33');
assertClose(psnrNoise.psnr, 32.90, 0.5, 'PSNR perhitungan derau ≈ 32.90 dB');

// 4. Chroma Subsampling 4:2:2 & 4:2:0
const chromaImg = new ImageData(4, 4);
for (let i = 0; i < 16; i++) {
  chromaImg.data[i * 4] = 200;
  chromaImg.data[i * 4 + 1] = 50;
  chromaImg.data[i * 4 + 2] = 100;
  chromaImg.data[i * 4 + 3] = 255;
}
const sub422 = Compression.applyChromaSubsampling(chromaImg, '4:2:2');
assert(sub422.width === 4 && sub422.height === 4, 'Chroma Subsampling 4:2:2 berhasil');
const sub420 = Compression.applyChromaSubsampling(chromaImg, '4:2:0');
assert(sub420.width === 4 && sub420.height === 4, 'Chroma Subsampling 4:2:0 berhasil');

console.log('\n=== TEST 4: KEAMANAN & EXIF (Security) ===');

// Mock JPEG buffer dengan APP1 Exif segment
const jpegBuffer = new Uint8Array([
  0xff, 0xd8,             // SOI
  0xff, 0xe1, 0x00, 0x10, // APP1 length 16
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xda              // SOS
]);

const exifDetect = Security.detectExif(jpegBuffer.buffer);
assert(exifDetect.hasExif === true, 'Deteksi segmen APP1 EXIF berhasil');
assert(exifDetect.isJpeg === true, 'Deteksi JPEG berhasil');

const nonJpegBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
const nonExifDetect = Security.detectExif(nonJpegBuffer.buffer);
assert(nonExifDetect.hasExif === false, 'File non-JPEG dideteksi tidak ada EXIF JPEG');

console.log('\n=== TEST 5: HISTOGRAM & KONVOLUSI (FiltersConvolution) ===');
const FiltersConvolution = require('../js/filters-convolution.js');

// Test Histogram
const histImg = new ImageData(2, 2);
histImg.data[0] = 50; histImg.data[4] = 100; histImg.data[8] = 150; histImg.data[12] = 200;
const hist = FiltersConvolution.computeHistogram(histImg);
assert(hist.r[50] === 1 && hist.r[100] === 1 && hist.r[150] === 1 && hist.r[200] === 1, 'Histogram frekuensi bin sesuai');
assert(hist.entropy > 0, 'Shannon Entropy terhitung > 0');

// Test Konvolusi 3x3 Box Blur
const convImg = new ImageData(3, 3);
for (let i = 0; i < 9 * 4; i += 4) {
  convImg.data[i] = 90;
  convImg.data[i + 1] = 90;
  convImg.data[i + 2] = 90;
  convImg.data[i + 3] = 255;
}
const blurred = FiltersConvolution.convolve3x3(convImg, [1,1,1,1,1,1,1,1,1], 9, 0);
assert(blurred.data[4 * 4] === 90, 'Box Blur pada citra konstan menghasilkan nilai konstan');

// Test Sobel Edge
const sobelOut = FiltersConvolution.applySobelEdge(convImg);
assert(sobelOut.width === 3 && sobelOut.height === 3, 'Sobel Edge detection berhasil diproses');

// Test Privacy Pixelation
const redactImg = new ImageData(4, 4);
for (let i = 0; i < 16; i++) {
  redactImg.data[i * 4] = i * 10;
  redactImg.data[i * 4 + 1] = 50;
  redactImg.data[i * 4 + 2] = 50;
  redactImg.data[i * 4 + 3] = 255;
}
FiltersConvolution.applyPrivacyPixelate(redactImg, 0, 0, 4, 4, 4);
// Semua piksel di dalam blok 4x4 harus seragam (rata-rata)
assert(redactImg.data[0] === redactImg.data[15 * 4], 'Sensor Pikselasi meratakan seluruh blok');

console.log(`\n========================================`);
console.log(`HASIL AKHIR: ${passCount} PASSED, ${failCount} FAILED`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('SEMUA RUMUS & MODUL SISTEM MULTIMEDIA LOLOS UJI!');
}
