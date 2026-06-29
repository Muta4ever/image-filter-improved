import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  Sparkles, 
  Image as ImageIcon, 
  Wand2, 
  SlidersHorizontal,
  Download,
  RotateCcw,
  Loader2,
  Check,
  Info,
  ArrowLeftRight,
  Stethoscope,
  Activity
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

type FilterType = "smoothing" | "artifact" | "edge" | "invert" | "contrast";

interface ImageMetrics {
  softness: number;
  exposure: number;
  contrast: number;
  artifactLevel: number;
  edgeDefinition: number;
  tissueSaturation: number;
}

const filterDescriptions: Record<FilterType, string> = {
  smoothing: "Soft Tissue Smoothing: Uses Gaussian distribution to reduce noise while preserving organ boundaries. Ideal for soft tissue MRIs.",
  artifact: "MRI/CT Artifact Removal: Uses a median filter to remove 'salt-and-pepper' sensor noise and scanning artifacts without blurring anatomical edges.",
  edge: "Bone Edge Enhancement: High-pass filtering that emphasizes skeletal structures, micro-calcifications, and fine anatomical details.",
  invert: "Radiograph Inversion: Creates a negative image, a standard technique to better visualize dense structures and contrast agents in X-rays.",
  contrast: "Vascular Contrast Stretch: Enhances dynamic range to highlight blood vessels and subtle density differences in CT scans."
};

const mockAISuggestions: Record<string, { filter: FilterType; reason: string }> = {
  high_noise: {
    filter: "artifact",
    reason: "High sensor artifact levels detected (typical of fast MRIs or low-dose CTs). Recommend **Artifact Removal** to clean the scan while preserving critical anatomical boundaries."
  },
  low_sharpness: {
    filter: "edge",
    reason: "The scan lacks edge definition. Recommend **Bone Edge Enhancement** to clarify skeletal structures, fractures, or micro-calcifications for easier diagnosis."
  },
  low_contrast_dark: {
    filter: "invert",
    reason: "Underexposed radiograph detected. Recommend **Radiograph Inversion** to highlight dense structures (like bone) against the darker background."
  },
  high_sharpness_noisy: {
    filter: "smoothing",
    reason: "Image is sharp but contains high-frequency noise. Recommend **Soft Tissue Smoothing** to soften the appearance and isolate the primary organ structures."
  },
  balanced: {
    filter: "contrast",
    reason: "Scan metrics are well-balanced. Recommend **Vascular Contrast Stretch** to maximize the dynamic range and highlight any subtle tissue abnormalities."
  }
};

function getAISuggestion(metrics: ImageMetrics) {
  if (metrics.artifactLevel > 70) return mockAISuggestions.high_noise;
  if (metrics.edgeDefinition < 40) return mockAISuggestions.low_sharpness;
  if (metrics.exposure < 80 && metrics.contrast < 50) return mockAISuggestions.low_contrast_dark;
  if (metrics.edgeDefinition > 80 && metrics.artifactLevel > 40) return mockAISuggestions.high_sharpness_noisy;
  return mockAISuggestions.balanced;
}

function generateRandomMetrics(): ImageMetrics {
  return {
    softness: Math.random() * 100,
    exposure: Math.random() * 200 + 30,
    contrast: Math.random() * 80 + 20,
    artifactLevel: Math.random() * 100,
    edgeDefinition: Math.random() * 100,
    tissueSaturation: Math.random() * 100
  };
}

const getDynamicFilterStyle = (filter: FilterType, intensity: number) => {
  const kernel = intensity / 10; // map 0-100 to 0-10 for CSS values
  switch (filter) {
    case "smoothing":
      return `blur(${kernel}px)`;
    case "artifact":
      return `blur(${kernel / 2}px) contrast(1.1)`;
    case "edge":
      return `contrast(${1 + kernel / 5}) brightness(1.1) saturate(0.5)`;
    case "invert":
      return `invert(${intensity}%) contrast(1.2)`;
    case "contrast":
      return `contrast(${1 + kernel / 3}) brightness(${1 - kernel/20})`;
    default:
      return "none";
  }
};

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("smoothing");
  const [intensity, setIntensity] = useState(80);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ filter: FilterType; reason: string } | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [downloadFormat, setDownloadFormat] = useState<"png" | "jpg">("png");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setMetrics(generateRandomMetrics());
        setAiSuggestion(null);
        setShowFiltered(false);
        setIsComparing(false);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setMetrics(generateRandomMetrics());
        setAiSuggestion(null);
        setShowFiltered(false);
        setIsComparing(false);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleGetAISuggestion = useCallback(() => {
    if (!metrics) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const suggestion = getAISuggestion(metrics);
      setAiSuggestion(suggestion);
      setSelectedFilter(suggestion.filter);
      setIsAnalyzing(false);
    }, 1500);
  }, [metrics]);

  const handleApplyFilter = useCallback(() => {
    setShowFiltered(true);
    setIsComparing(false);
  }, []);

  const handleReset = useCallback(() => {
    setUploadedImage(null);
    setMetrics(null);
    setAiSuggestion(null);
    setShowFiltered(false);
    setIsComparing(false);
    setIntensity(80);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!uploadedImage) return;
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (ctx) {
        // Draw original
        ctx.drawImage(img, 0, 0);
        
        // Filter application
        ctx.filter = getDynamicFilterStyle(selectedFilter, intensity);
        ctx.drawImage(img, 0, 0);
        
        const link = document.createElement("a");
        link.download = `clinical-scan-enhanced.${downloadFormat}`;
        link.href = canvas.toDataURL(`image/${downloadFormat === 'jpg' ? 'jpeg' : 'png'}`, 0.9);
        link.click();
      }
    };
    img.src = uploadedImage;
  }, [uploadedImage, selectedFilter, intensity, downloadFormat]);

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
            Upload CT, MRI, or X-Ray scans. Get intelligent diagnostic filter recommendations powered by AI, 
            and apply clinical-grade enhancements to clarify anatomical structures.
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
                    <p className="text-muted-foreground/60 text-xs mt-4">Supports JPG, PNG (DICOM coming soon)</p>
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
                  <div className="relative rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center min-h-[300px]" data-testid="container-image-preview">
                    {/* Base Image */}
                    <img
                      src={uploadedImage}
                      alt="Original Scan"
                      className="w-full h-auto max-h-[450px] object-contain"
                      data-testid="img-original"
                    />

                    {/* Filtered Overlay */}
                    {showFiltered && (
                      <div 
                        className="absolute inset-0 bg-transparent flex items-center justify-center"
                        style={{ 
                          clipPath: isComparing ? `inset(0 0 0 ${comparePosition}%)` : 'none',
                        }}
                      >
                        <img
                          src={uploadedImage}
                          alt="Enhanced Scan"
                          className="w-full h-auto max-h-[450px] object-contain"
                          style={{ filter: getDynamicFilterStyle(selectedFilter, intensity) }}
                          data-testid="img-filtered"
                        />
                      </div>
                    )}

                    {/* Comparison Slider Overlay */}
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
                          <Badge className="bg-black/80 text-white backdrop-blur-md border border-white/20">Original</Badge>
                        </div>
                        <div className="absolute top-4 right-4 z-10">
                          <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-md shadow-lg">Enhanced</Badge>
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
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Exposure</p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">{metrics.exposure.toFixed(1)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Contrast</p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">{metrics.contrast.toFixed(1)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Artifacts</p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">{metrics.artifactLevel.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Edge Def.</p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">{metrics.edgeDefinition.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Softness</p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">{metrics.softness.toFixed(1)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50 border border-muted">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Saturation</p>
                        <p className="font-mono text-sm font-semibold text-cyan-400">{metrics.tissueSaturation.toFixed(1)}%</p>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <Button 
                      onClick={handleGetAISuggestion}
                      disabled={isAnalyzing}
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
                          Diagnostic AI Suggestion
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
                          <Badge variant="secondary" className="text-xs border-primary/20 text-primary">AI Driven</Badge>
                        </h3>
                        <p className="text-muted-foreground leading-relaxed" data-testid="text-ai-suggestion">
                          {aiSuggestion.reason.split("**").map((part, i) => 
                            i % 2 === 1 ? <strong key={i} className="text-foreground text-primary">{part}</strong> : part
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
                <h2 className="font-display text-xl font-semibold">Enhancement Controls</h2>
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
                      setShowFiltered(false);
                      setIsComparing(false);
                    }}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-primary/20" data-testid="select-filter-type">
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
                    <span className="font-mono text-sm text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded" data-testid="text-intensity">
                      {intensity}%
                    </span>
                  </div>
                  <Slider
                    value={[intensity]}
                    onValueChange={(v) => {
                      setIntensity(v[0]);
                    }}
                    min={0}
                    max={100}
                    step={1}
                    className="py-2"
                    data-testid="slider-intensity"
                  />
                  <p className="text-xs text-muted-foreground">Adjust algorithm intensity applied to the scan.</p>
                </div>

                <div className="pt-4 space-y-3">
                  {!showFiltered ? (
                    <Button 
                      onClick={handleApplyFilter}
                      disabled={!uploadedImage}
                      className="w-full h-12 rounded-xl font-medium text-base shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                      data-testid="button-apply-filter"
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Apply Clinical Enhancement
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
                          <Select value={downloadFormat} onValueChange={(v: "png" | "jpg") => setDownloadFormat(v)}>
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
                        onClick={() => {
                          setShowFiltered(false);
                          setIsComparing(false);
                        }}
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
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Clinical Modalities</h3>
              <div className="grid grid-cols-2 gap-3">
                {(["smoothing", "artifact", "edge", "invert"] as FilterType[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setSelectedFilter(filter);
                      setShowFiltered(false);
                      setIsComparing(false);
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
                ))}
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
          <p>This tool is for demonstration and research purposes only. Not intended for direct diagnostic use without professional review.</p>
        </motion.footer>
      </div>
    </div>
  );
}
