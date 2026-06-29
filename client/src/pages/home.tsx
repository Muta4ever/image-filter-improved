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
  Info
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

type FilterType = "gaussian" | "median" | "lowpass" | "highpass";

interface ImageMetrics {
  blur: number;
  brightness: number;
  contrast: number;
  noiseLevel: number;
  sharpness: number;
  saturation: number;
}

const filterDescriptions: Record<FilterType, string> = {
  gaussian: "Smooths the image using Gaussian distribution, reducing noise while preserving edges.",
  median: "Removes salt-and-pepper noise while preserving sharp edges in the image.",
  lowpass: "Removes high-frequency details, creating a smooth, soft appearance.",
  highpass: "Enhances edges and fine details, creating a sharpened effect."
};

const mockAISuggestions: Record<string, { filter: FilterType; reason: string }> = {
  high_noise: {
    filter: "median",
    reason: "Your image has a high noise level. I recommend the **Median Blur** filter to effectively remove \"salt and pepper\" noise while preserving the sharp edges of your subject."
  },
  low_sharpness: {
    filter: "highpass",
    reason: "Your image lacks sharpness. I recommend the **High Pass** filter to enhance edges and bring out fine details, making the image look crisp and focused."
  },
  low_contrast_dark: {
    filter: "gaussian",
    reason: "Your image is dark and has low contrast. I recommend a slight **Gaussian Blur** to reduce any noise from low-light conditions, followed by post-processing to brighten."
  },
  high_sharpness_noisy: {
    filter: "lowpass",
    reason: "Your image is very sharp but appears slightly noisy. I recommend the **Low Pass** filter to soften the overall appearance and remove high-frequency artifacts."
  },
  balanced: {
    filter: "gaussian",
    reason: "Your image has well-balanced metrics. I recommend the **Gaussian Blur** filter for a soft, professional look that works perfectly for portraits and product photography."
  }
};

function getAISuggestion(metrics: ImageMetrics) {
  if (metrics.noiseLevel > 70) return mockAISuggestions.high_noise;
  if (metrics.sharpness < 40) return mockAISuggestions.low_sharpness;
  if (metrics.brightness < 80 && metrics.contrast < 50) return mockAISuggestions.low_contrast_dark;
  if (metrics.sharpness > 80 && metrics.noiseLevel > 40) return mockAISuggestions.high_sharpness_noisy;
  return mockAISuggestions.balanced;
}

function generateRandomMetrics(): ImageMetrics {
  return {
    blur: Math.random() * 800 + 50,
    brightness: Math.random() * 200 + 30,
    contrast: Math.random() * 80 + 20,
    noiseLevel: Math.random() * 100,
    sharpness: Math.random() * 100,
    saturation: Math.random() * 100
  };
}

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("gaussian");
  const [kernelSize, setKernelSize] = useState(5);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ filter: FilterType; reason: string } | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);
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
  }, []);

  const handleReset = useCallback(() => {
    setUploadedImage(null);
    setMetrics(null);
    setAiSuggestion(null);
    setShowFiltered(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const getFilterClass = (filter: FilterType) => {
    switch (filter) {
      case "gaussian":
      case "lowpass":
        return "filter-blur";
      case "median":
        return "filter-blur opacity-95";
      case "highpass":
        return "filter-sharpen";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-500/3 rounded-full blur-[150px]" />
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
              <Wand2 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            <span className="gradient-text">AI Image Filter</span> App
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Upload your image, get intelligent filter recommendations powered by AI, 
            and apply professional-grade filters with precision control.
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
                <h2 className="font-display text-xl font-semibold">Image Upload</h2>
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
                    <p className="text-lg font-medium mb-2">Drop your image here</p>
                    <p className="text-muted-foreground text-sm">or click to browse</p>
                    <p className="text-muted-foreground/60 text-xs mt-4">Supports JPG, JPEG, PNG</p>
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
                  <div className="relative rounded-2xl overflow-hidden bg-black/20">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className={`w-full h-auto max-h-[400px] object-contain transition-all duration-500 ${showFiltered ? getFilterClass(selectedFilter) : ""}`}
                      data-testid="img-uploaded"
                    />
                    {showFiltered && (
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-primary/90 text-primary-foreground">
                          <Check className="w-3 h-3 mr-1" />
                          {selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Applied
                        </Badge>
                      </div>
                    )}
                  </div>

                  {metrics && (
                    <motion.div 
                      className="grid grid-cols-3 gap-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Blur</p>
                        <p className="font-mono text-sm font-semibold" data-testid="text-blur-score">{metrics.blur.toFixed(1)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Brightness</p>
                        <p className="font-mono text-sm font-semibold" data-testid="text-brightness-score">{metrics.brightness.toFixed(1)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Contrast</p>
                        <p className="font-mono text-sm font-semibold" data-testid="text-contrast-score">{metrics.contrast.toFixed(1)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Noise</p>
                        <p className="font-mono text-sm font-semibold" data-testid="text-noise-score">{metrics.noiseLevel.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Sharpness</p>
                        <p className="font-mono text-sm font-semibold" data-testid="text-sharpness-score">{metrics.sharpness.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Saturation</p>
                        <p className="font-mono text-sm font-semibold" data-testid="text-saturation-score">{metrics.saturation.toFixed(1)}%</p>
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
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Get AI Suggestion
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleReset}
                      className="h-12 px-4 rounded-xl"
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
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
                          AI Recommendation
                          <Badge variant="secondary" className="text-xs">GPT-4</Badge>
                        </h3>
                        <p className="text-muted-foreground leading-relaxed" data-testid="text-ai-suggestion">
                          {aiSuggestion.reason.split("**").map((part, i) => 
                            i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
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
                <h2 className="font-display text-xl font-semibold">Filter Controls</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Filter Type</label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{filterDescriptions[selectedFilter]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={selectedFilter} 
                    onValueChange={(v) => {
                      setSelectedFilter(v as FilterType);
                      setShowFiltered(false);
                    }}
                  >
                    <SelectTrigger className="h-12 rounded-xl" data-testid="select-filter-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gaussian">Gaussian Blur</SelectItem>
                      <SelectItem value="median">Median Blur</SelectItem>
                      <SelectItem value="lowpass">Low Pass</SelectItem>
                      <SelectItem value="highpass">High Pass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Kernel Size</label>
                    <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-1 rounded" data-testid="text-kernel-size">
                      {kernelSize}
                    </span>
                  </div>
                  <Slider
                    value={[kernelSize]}
                    onValueChange={(v) => {
                      const newVal = v[0] % 2 === 0 ? v[0] + 1 : v[0];
                      setKernelSize(newVal);
                      setShowFiltered(false);
                    }}
                    min={1}
                    max={31}
                    step={2}
                    className="py-2"
                    data-testid="slider-kernel-size"
                  />
                  <p className="text-xs text-muted-foreground">Odd numbers only (1-31)</p>
                </div>

                <div className="pt-4 space-y-3">
                  <Button 
                    onClick={handleApplyFilter}
                    disabled={!uploadedImage}
                    className="w-full h-12 rounded-xl font-medium text-base"
                    data-testid="button-apply-filter"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Apply Filter
                  </Button>

                  {showFiltered && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Button 
                        variant="outline"
                        className="w-full h-12 rounded-xl font-medium"
                        data-testid="button-download"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Filtered Image
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="glass p-5 rounded-2xl">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Available Filters</h3>
              <div className="grid grid-cols-2 gap-3">
                {(["gaussian", "median", "lowpass", "highpass"] as FilterType[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setSelectedFilter(filter);
                      setShowFiltered(false);
                    }}
                    className={`p-3 rounded-xl text-left transition-all ${
                      selectedFilter === filter 
                        ? "bg-primary/10 border border-primary/30" 
                        : "bg-muted/30 border border-transparent hover:bg-muted/50"
                    }`}
                    data-testid={`button-filter-${filter}`}
                  >
                    <p className="font-medium text-sm capitalize">{filter.replace("pass", " Pass")}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {filter === "gaussian" && "Smooth & soft"}
                      {filter === "median" && "Noise reduction"}
                      {filter === "lowpass" && "Remove details"}
                      {filter === "highpass" && "Enhance edges"}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.footer 
          className="mt-16 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p>Powered by AI image analysis and professional-grade filter algorithms</p>
        </motion.footer>
      </div>
    </div>
  );
}