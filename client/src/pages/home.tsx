import {
  useState,
  useRef,
  useCallback,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Image as ImageIcon,
  SlidersHorizontal,
  Download,
  RotateCcw,
  Loader2,
  Check,
  Info,
  ArrowLeftRight,
  Stethoscope,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FilterType, ImageMetrics } from "@/lib/imageProcessing";
import { applyFilterAsync, computeMetricsAsync } from "@/lib/imageClient";

const filterDescriptions: Record<FilterType, string> = {
  smoothing:
    "Soft Tissue Smoothing: separable Gaussian convolution that reduces noise while preserving organ boundaries. Ideal for soft-tissue MRIs.",
  artifact:
    "MRI/CT Artifact Removal: a 3×3 median filter that removes 'salt-and-pepper' sensor noise and scanning artifacts without blurring anatomical edges.",
  edge: "Bone Edge Enhancement: unsharp-mask (high-pass) sharpening that emphasizes skeletal structures, micro-calcifications, and fine detail.",
  invert:
    "Radiograph Inversion: per-pixel negative, a standard technique to better visualize dense structures and contrast agents in X-rays.",
  contrast:
    "Vascular Contrast Stretch: percentile-clipped histogram stretch that expands dynamic range to highlight vessels and subtle density differences.",
};

const aiRecommendations: Record<string, { filter: FilterType; reason: string }> = {
  high_noise: {
    filter: "artifact",
    reason:
      "High sensor noise measured (Laplacian estimator, typical of fast MRIs or low-dose CTs). Recommend **Artifact Removal** to clean the scan while preserving critical anatomical boundaries.",
  },
  low_sharpness: {
    filter: "edge",
    reason:
      "Low edge definition measured (weak Sobel gradients). Recommend **Bone Edge Enhancement** to clarify skeletal structures, fractures, or micro-calcifications for easier diagnosis.",
  },
  low_contrast_dark: {
    filter: "invert",
    reason:
      "Underexposed radiograph detected (low mean luminance and contrast). Recommend **Radiograph Inversion** to highlight dense structures against the darker background.",
  },
  high_sharpness_noisy: {
    filter: "smoothing",
    reason:
      "Image is sharp but carries high-frequency noise. Recommend **Soft Tissue Smoothing** to soften the appearance and isolate the primary organ structures.",
  },
  balanced: {
    filter: "contrast",
    reason:
      "Scan metrics are well-balanced. Recommend **Vascular Contrast Stretch** to maximize dynamic range and highlight subtle tissue abnormalities.",
  },
};

/** Heuristic recommender driven by the *measured* metrics. */
function getAISuggestion(metrics: ImageMetrics) {
  if (metrics.artifactLevel > 55) return aiRecommendations.high_noise;
  if (metrics.edgeDefinition < 35) return aiRecommendations.low_sharpness;
  if (metrics.exposure < 80 && metrics.contrast < 45)
    return aiRecommendations.low_contrast_dark;
  if (metrics.edgeDefinition > 70 && metrics.artifactLevel > 35)
    return aiRecommendations.high_sharpness_noisy;
  return aiRecommendations.balanced;
}

/** Decode a data URL and read its raw RGBA pixels off an offscreen canvas. */
function imageToPixels(
  src: string,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not acquire 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
      });
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("smoothing");
  const [intensity, setIntensity] = useState(80);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    filter: FilterType;
    reason: string;
  } | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [downloadFormat, setDownloadFormat] = useState<"png" | "jpg">("png");

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Raw source pixels (read once on upload) and the latest processed canvas.
  const sourceRef = useRef<{
    data: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const ingestImage = useCallback(async (dataUrl: string) => {
    setUploadedImage(dataUrl);
    setProcessedImage(null);
    setMetrics(null);
    setAiSuggestion(null);
    setShowFiltered(false);
    setIsComparing(false);
    sourceRef.current = null;
    processedCanvasRef.current = null;

    try {
      const pixels = await imageToPixels(dataUrl);
      sourceRef.current = pixels;
      const measured = await computeMetricsAsync(
        pixels.data,
        pixels.width,
        pixels.height,
      );
      setMetrics(measured);
    } catch (err) {
      console.error("Failed to analyze image", err);
    }
  }, []);

  const readFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === "string") void ingestImage(result);
      };
      reader.readAsDataURL(file);
    },
    [ingestImage],
  );

  const handleFileUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      readFile(e.target.files?.[0]);
    },
    [readFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) readFile(file);
    },
    [readFile],
  );

  const handleGetAISuggestion = useCallback(() => {
    if (!metrics) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const suggestion = getAISuggestion(metrics);
      setAiSuggestion(suggestion);
      setSelectedFilter(suggestion.filter);
      setShowFiltered(false);
      setIsComparing(false);
      setIsAnalyzing(false);
    }, 600);
  }, [metrics]);

  const handleApplyFilter = useCallback(async () => {
    const source = sourceRef.current;
    if (!source) return;
    setIsProcessing(true);
    try {
      const result = await applyFilterAsync(
        selectedFilter,
        intensity,
        source.data,
        source.width,
        source.height,
      );
      const canvas = document.createElement("canvas");
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.putImageData(
        new ImageData(
          new Uint8ClampedArray(result.buffer),
          result.width,
          result.height,
        ),
        0,
        0,
      );
      processedCanvasRef.current = canvas;
      setProcessedImage(canvas.toDataURL("image/png"));
      setShowFiltered(true);
      setIsComparing(false);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFilter, intensity]);

  const handleReset = useCallback(() => {
    setUploadedImage(null);
    setProcessedImage(null);
    setMetrics(null);
    setAiSuggestion(null);
    setShowFiltered(false);
    setIsComparing(false);
    setIntensity(80);
    sourceRef.current = null;
    processedCanvasRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    const mime = downloadFormat === "jpg" ? "image/jpeg" : "image/png";
    const link = document.createElement("a");
    link.download = `clinical-scan-enhanced.${downloadFormat}`;
    link.href = canvas.toDataURL(mime, 0.92);
    link.click();
  }, [downloadFormat]);

  // Changing the filter or intensity invalidates the rendered result.
  const invalidateResult = useCallback(() => {
    setShowFiltered(false);
    setIsComparing(false);
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-500/3 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        <motion.header
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
              <Activity className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Clinical <span className="gradient-text">Image Enhancer</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Upload CT, MRI, or X-Ray scans. Pixel-level analysis measures
            exposure, contrast, noise, and edge definition to recommend a
            filter, then real spatial-domain enhancements clarify anatomical
            structures.
          </p>
        </motion.header>

        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="glass-strong p-6 rounded-3xl h-full">
              <div className="flex items-center gap-2 mb-6">
                <ImageIcon className="w-5 h-5 text-primary" />
                <h2 className="font-display text-xl font-semibold">Upload Scan</h2>
              </div>

              {!uploadedImage ? (
                <label
                  htmlFor="file-upload"
                  className="relative block cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div
                    className="border-2 border-dashed border-muted-foreground/30 rounded-2xl p-12 text-center transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 group"
                    data-testid="dropzone-upload"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-lg font-medium mb-2">Drop medical scan here</p>
                    <p className="text-muted-foreground text-sm">or click to browse</p>
                    <p className="text-muted-foreground/60 text-xs mt-4">
                      Supports JPG, PNG (DICOM coming soon)
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    accept="image/jpg,image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFileUpload}
                    data-testid="input-file-upload"
                  />
                </label>
              ) : (
                <div className="space-y-6">
                  <div
                    className="relative rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center min-h-[300px]"
                    data-testid="container-image-preview"
                  >
                    {/* Base / original image */}
                    <img
                      src={uploadedImage}
                      alt="Original Scan"
                      className="w-full h-auto max-h-[450px] object-contain"
                      data-testid="img-original"
                    />

                    {/* Processed overlay (real pixels, not a CSS filter) */}
                    {showFiltered && processedImage && (
                      <div
                        className="absolute inset-0 bg-transparent flex items-center justify-center"
                        style={{
                          clipPath: isComparing
                            ? `inset(0 0 0 ${comparePosition}%)`
                            : "none",
                        }}
                      >
                        <img
                          src={processedImage}
                          alt="Enhanced Scan"
                          className="w-full h-auto max-h-[450px] object-contain"
                          data-testid="img-filtered"
                        />
                      </div>
                    )}

                    {/* Comparison slider overlay */}
                    {showFiltered && isComparing && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(0,0,0,0.8)] z-10"
                          style={{ left: `${comparePosition}%` }}
                        >
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-cyan-400 text-black rounded-full shadow-lg flex items-center justify-center pointer-events-auto cursor-ew-resize">
                            <ArrowLeftRight className="w-4 h-4" />
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={comparePosition}
                          onChange={(e) => setComparePosition(Number(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize pointer-events-auto z-20"
                          data-testid="slider-compare"
                        />
                      </div>
                    )}

                    {/* Badges */}
                    {showFiltered && !isComparing && (
                      <div className="absolute top-4 right-4 z-10">
                        <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-md shadow-lg">
                          <Check className="w-3 h-3 mr-1" />
                          Enhanced ({intensity}%)
                        </Badge>
                      </div>
                    )}

                    {showFiltered && isComparing && (
                      <>
                        <div className="absolute top-4 left-4 z-10">
                          <Badge className="bg-black/80 text-white backdrop-blur-md border border-white/20">
                            Original
                          </Badge>
                        </div>
                        <div className="absolute top-4 right-4 z-10">
                          <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-md shadow-lg">
                            Enhanced
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>

                  {metrics && (
                    <motion.div
                      className="grid grid-cols-3 gap-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Exposure
                        </p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">
                          {metrics.exposure.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Contrast
                        </p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">
                          {metrics.contrast.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Artifacts
                        </p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">
                          {metrics.artifactLevel.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Edge Def.
                        </p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">
                          {metrics.edgeDefinition.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Softness
                        </p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">
                          {metrics.softness.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Saturation
                        </p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">
                          {metrics.tissueSaturation.toFixed(1)}%
                        </p>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={handleGetAISuggestion}
                      disabled={isAnalyzing || !metrics}
                      className="flex-1 h-12 rounded-xl font-medium"
                      data-testid="button-get-ai-suggestion"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing Scan...
                        </>
                      ) : (
                        <>
                          <Stethoscope className="w-4 h-4 mr-2" />
                          Recommend Enhancement
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="h-12 px-4 rounded-xl border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      data-testid="button-reset"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-6"
          >
            <AnimatePresence mode="wait">
              {aiSuggestion && (
                <motion.div
                  key="ai-suggestion"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card className="p-6 rounded-3xl gradient-border bg-primary/5 glow">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-primary/20 shrink-0">
                        <Stethoscope className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
                          Diagnostic Recommendation
                          <Badge
                            variant="secondary"
                            className="text-xs border-primary/20 text-primary"
                          >
                            Rule-Based
                          </Badge>
                        </h3>
                        <p
                          className="text-muted-foreground leading-relaxed"
                          data-testid="text-ai-suggestion"
                        >
                          {aiSuggestion.reason.split("**").map((part, i) =>
                            i % 2 === 1 ? (
                              <strong key={i} className="text-foreground text-primary">
                                {part}
                              </strong>
                            ) : (
                              part
                            ),
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card className="glass-strong p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-6">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                <h2 className="font-display text-xl font-semibold">
                  Enhancement Controls
                </h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Modality / Filter Type</label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs border-primary/20">
                        <p>{filterDescriptions[selectedFilter]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={selectedFilter}
                    onValueChange={(v) => {
                      setSelectedFilter(v as FilterType);
                      invalidateResult();
                    }}
                  >
                    <SelectTrigger
                      className="h-12 rounded-xl border-primary/20"
                      data-testid="select-filter-type"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smoothing">Soft Tissue Smoothing</SelectItem>
                      <SelectItem value="artifact">MRI/CT Artifact Removal</SelectItem>
                      <SelectItem value="edge">Bone Edge Enhancement</SelectItem>
                      <SelectItem value="invert">Radiograph Inversion (Negative)</SelectItem>
                      <SelectItem value="contrast">Vascular Contrast Stretch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Enhancement Intensity</label>
                    <span
                      className="font-mono text-sm text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded"
                      data-testid="text-intensity"
                    >
                      {intensity}%
                    </span>
                  </div>
                  <Slider
                    value={[intensity]}
                    onValueChange={(v) => {
                      setIntensity(v[0]);
                      invalidateResult();
                    }}
                    min={0}
                    max={100}
                    step={1}
                    className="py-2"
                    data-testid="slider-intensity"
                  />
                  <p className="text-xs text-muted-foreground">
                    Adjust algorithm intensity applied to the scan.
                  </p>
                </div>

                <div className="pt-4 space-y-3">
                  {!showFiltered ? (
                    <Button
                      onClick={handleApplyFilter}
                      disabled={!metrics || isProcessing}
                      className="w-full h-12 rounded-xl font-medium text-base shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                      data-testid="button-apply-filter"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Activity className="w-4 h-4 mr-2" />
                          Apply Clinical Enhancement
                        </>
                      )}
                    </Button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant={isComparing ? "secondary" : "outline"}
                          onClick={() => setIsComparing(!isComparing)}
                          className="h-12 rounded-xl font-medium border-primary/20 hover:bg-primary/10"
                          data-testid="button-compare"
                        >
                          <ArrowLeftRight className="w-4 h-4 mr-2" />
                          {isComparing ? "Exit Compare" : "Compare View"}
                        </Button>

                        <div className="flex bg-primary text-primary-foreground rounded-xl overflow-hidden hover:bg-primary/90 transition-colors cursor-pointer group shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                          <Button
                            onClick={handleDownload}
                            className="flex-1 h-12 rounded-none font-medium border-r border-primary-foreground/20 group-hover:bg-transparent"
                            data-testid="button-download"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                          <Select
                            value={downloadFormat}
                            onValueChange={(v: "png" | "jpg") => setDownloadFormat(v)}
                          >
                            <SelectTrigger className="w-[70px] h-12 rounded-none border-0 bg-transparent text-primary-foreground focus:ring-0 focus:ring-offset-0 px-2 py-0 mx-0 outline-none ring-0 focus-visible:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="png">PNG</SelectItem>
                              <SelectItem value="jpg">JPG</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={invalidateResult}
                        className="w-full h-10 text-muted-foreground hover:text-foreground"
                      >
                        Adjust Enhancement Settings
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="glass p-5 rounded-2xl">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                Clinical Modalities
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(["smoothing", "artifact", "edge", "invert"] as FilterType[]).map(
                  (filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setSelectedFilter(filter);
                        invalidateResult();
                      }}
                      className={`p-3 rounded-xl text-left transition-all ${
                        selectedFilter === filter
                          ? "bg-primary/10 border border-primary/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                          : "bg-muted/30 border border-transparent hover:bg-muted/50"
                      }`}
                      data-testid={`button-filter-${filter}`}
                    >
                      <p className="font-medium text-sm">
                        {filter === "smoothing" && "Soft Tissue"}
                        {filter === "artifact" && "Artifact Removal"}
                        {filter === "edge" && "Bone Edge"}
                        {filter === "invert" && "Radiograph Neg"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {filter === "smoothing" && "For MRI noise"}
                        {filter === "artifact" && "CT/MRI cleaning"}
                        {filter === "edge" && "Skeletal structures"}
                        {filter === "invert" && "X-Ray contrast"}
                      </p>
                    </button>
                  ),
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.footer
          className="mt-16 text-center text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p>
            This tool is for demonstration and research purposes only. Not
            intended for direct diagnostic use without professional review.
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
