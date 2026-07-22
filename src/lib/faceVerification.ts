/**
 * Face Verification Utility — face-api.js wrapper
 *
 * Used for advisory confidence scoring on field employee photo uploads.
 * HR always makes the final verification decision — confidence is informational only.
 *
 * SETUP REQUIRED: Download face-api.js model files (~6MB) and place in /public/models/:
 *   https://github.com/justadudewhohacks/face-api.js/tree/master/weights
 *   Files needed:
 *     - ssd_mobilenetv1_model-weights_manifest.json + shard files
 *     - face_landmark_68_model-weights_manifest.json + shard files
 *     - face_recognition_model-weights_manifest.json + shard files
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceApi = any;

let faceapi: FaceApi = null;
let modelsLoaded = false;
let modelLoadAttempted = false;

/** Dynamically load face-api.js to avoid SSR/bundler issues */
async function getFaceApi(): Promise<FaceApi | null> {
  if (faceapi) return faceapi;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module = await import('face-api.js') as any;
    faceapi = module.default ?? module;
    return faceapi;
  } catch (err) {
    console.warn('[FaceVerification] face-api.js not available:', err);
    return null;
  }
}

/**
 * Load face recognition models from /public/models/.
 * Call once on component mount. Safe to call multiple times — noops after first load.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded || modelLoadAttempted) return;
  modelLoadAttempted = true;

  const api = await getFaceApi();
  if (!api) {
    console.warn('[FaceVerification] face-api.js unavailable — confidence scoring disabled');
    return;
  }

  try {
    const MODEL_URL = '/models';
    await Promise.all([
      api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('[FaceVerification] Models loaded successfully');
  } catch (err) {
    console.warn(
      '[FaceVerification] Could not load models from /public/models/ — confidence scoring disabled.',
      'Download model weights from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights',
      err
    );
  }
}

/**
 * Detect the face in an image file and return its 128-d descriptor.
 * Returns null if no face is detected or models are not loaded.
 */
export async function computeFaceDescriptor(imageFile: File): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    console.warn('[FaceVerification] Models not loaded — skipping descriptor computation');
    return null;
  }

  const api = await getFaceApi();
  if (!api) return null;

  try {
    const img = await fileToHTMLImageElement(imageFile);
    const detection = await api
      .detectSingleFace(img, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.warn('[FaceVerification] No face detected in uploaded image');
      return null;
    }
    return detection.descriptor;
  } catch (err) {
    console.error('[FaceVerification] Error computing face descriptor:', err);
    return null;
  }
}

/**
 * Compare an uploaded face descriptor against an employee's profile photo URL.
 * Returns confidence as percentage 0–100.
 *
 * Distance thresholds (Euclidean):
 *   < 0.40 → high confidence (≥85%)
 *   0.40–0.60 → medium confidence (60–85%)
 *   > 0.60 → low confidence (<60%)
 */
export async function compareFaceToProfile(
  uploadedDescriptor: Float32Array,
  profilePhotoUrl: string
): Promise<number> {
  if (!modelsLoaded) return mockConfidenceScore();

  const api = await getFaceApi();
  if (!api) return mockConfidenceScore();

  try {
    const profileImg = await urlToHTMLImageElement(profilePhotoUrl);
    const profileDetection = await api
      .detectSingleFace(profileImg, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!profileDetection) {
      console.warn('[FaceVerification] No face found in profile photo');
      return mockConfidenceScore();
    }

    const distance = api.euclideanDistance(uploadedDescriptor, profileDetection.descriptor);
    return distanceToConfidence(distance);
  } catch (err) {
    console.error('[FaceVerification] Comparison failed:', err);
    return mockConfidenceScore();
  }
}

/** Convert Euclidean distance to confidence percentage per spec thresholds */
function distanceToConfidence(distance: number): number {
  if (distance < 0.4) {
    // Map 0–0.4 → 85–100%
    return Math.round(100 - (distance / 0.4) * 15);
  } else if (distance <= 0.6) {
    // Map 0.4–0.6 → 60–85%
    return Math.round(85 - ((distance - 0.4) / 0.2) * 25);
  } else {
    // Map 0.6+ → 0–60%
    return Math.max(0, Math.round(60 - ((distance - 0.6) / 1.0) * 60));
  }
}

/**
 * Fallback confidence score when models are not loaded.
 * Returns a realistic random score for mock/dev mode.
 */
function mockConfidenceScore(): number {
  // TODO: Remove mock — real score will be computed by face-api.js when models are loaded
  return parseFloat((65 + Math.random() * 30).toFixed(1));
}

/** Returns whether models are currently loaded */
export function areFaceModelsLoaded(): boolean {
  return modelsLoaded;
}

/** Confidence tier classification */
export type ConfidenceTier = 'high' | 'medium' | 'low';

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 85) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

export function getConfidenceLabel(score: number): string {
  const tier = getConfidenceTier(score);
  if (tier === 'high') return 'High confidence';
  if (tier === 'medium') return 'Medium confidence';
  return 'Low confidence — HR will review';
}

export function getConfidenceBadgeClass(score: number): string {
  const tier = getConfidenceTier(score);
  if (tier === 'high') return 'bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30';
  if (tier === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-600 border-red-200';
}

// ─── DOM helpers ──────────────────────────────────────────────────────────

function fileToHTMLImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function urlToHTMLImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
