import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload, Sparkles, Download, RefreshCw, Layers, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import { getAllTrades, getTrade, isValidTradeId } from '../config/trades';
import type { TradeId } from '../config/types';
import { getDefaultRenderSettings, getRenderOptionsForTrade } from '../config/trades/renderOptions';
import { useAIAssistant } from '../context/AIAssistantContext';
import { useResolvedTrade } from '../hooks/useResolvedTrade';
import { Badge } from './ui/badge';
import { buildRenderPrompt, generateAiRender } from '../engine/ai/renderService';

export default function AIBathroomRender() {
  const { tradeId: routeTradeId } = useParams();
  const navigate = useNavigate();
  const { setIsOpen, requestVoiceStart, setPageContext } = useAIAssistant();
  const { tradeId: resolvedTradeId, isAiDetected, setTradeOverride } = useResolvedTrade();
  const [showManualPicker, setShowManualPicker] = useState(false);

  const routeTrade = routeTradeId && isValidTradeId(routeTradeId) ? routeTradeId : null;
  const tradeId: TradeId | null = routeTrade ?? resolvedTradeId;

  const trade = tradeId ? getTrade(tradeId) : null;
  const renderGroups = tradeId ? getRenderOptionsForTrade(tradeId) : [];

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>(() =>
    tradeId ? getDefaultRenderSettings(tradeId) : {}
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setPageContext({
      route: tradeId ? `/ai-render/${tradeId}` : '/ai-render',
      page: 'ai-design',
      tradeId: tradeId ?? null,
    });
  }, [tradeId, setPageContext]);

  useEffect(() => {
    if (!tradeId) return;
    setSettings(getDefaultRenderSettings(tradeId));
    setRenderedImage(null);
  }, [tradeId]);

  const openAssistantWithVoice = useCallback(() => {
    requestVoiceStart();
    setIsOpen(true);
  }, [requestVoiceStart, setIsOpen]);

  const drawProductLabel = (ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string) => {
    ctx.save();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✓', x, y + 8);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x - 60, y + 40, 120, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(label, x, y + 52);
    ctx.font = '10px Arial';
    ctx.fillText(value.slice(0, 14), x, y + 64);
    ctx.restore();
  };

  const drawOverlay = useCallback(() => {
    const source = renderedImage ?? uploadedImage;
    if (!canvasRef.current || !source || !trade) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const finishGroup = renderGroups.find(g => g.key === 'finish');
      const finishOpt = finishGroup?.options.find(o => o.value === settings.finish);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(20, canvas.height - 80, 280, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`${trade.name} — ${finishOpt?.label ?? 'Design'}`, 30, canvas.height - 45);

      if (finishOpt?.color) {
        ctx.fillStyle = finishOpt.color;
        ctx.fillRect(30, canvas.height - 35, 40, 20);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, canvas.height - 35, 40, 20);
      }

      const xPos = canvas.width / (renderGroups.length + 1);
      renderGroups.slice(0, 4).forEach((group, i) => {
        const opt = group.options.find(o => o.value === settings[group.key]);
        drawProductLabel(ctx, xPos * (i + 1), 100, group.label, opt?.label ?? settings[group.key] ?? '');
      });
    };

    img.src = source;
  }, [renderedImage, uploadedImage, trade, renderGroups, settings]);

  useEffect(() => {
    if (!renderedImage || !showOverlay) return;
    // Draw after canvas mounts from the renderedImage branch
    const id = requestAnimationFrame(() => drawOverlay());
    return () => cancelAnimationFrame(id);
  }, [renderedImage, showOverlay, settings, drawOverlay]);

  const handleTradeChange = (id: string) => {
    if (isValidTradeId(id)) {
      navigate(`/ai-render/${id}`, { replace: true });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setRenderedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRender = async () => {
    if (!trade || !tradeId) {
      toast.error('Describe the job in AI or pick a trade first');
      return;
    }
    if (!uploadedImage) {
      toast.error(`Please upload a ${trade.name.toLowerCase()} photo first`);
      return;
    }

    setIsRendering(true);
    toast.info(`AI is generating your ${trade.name.toLowerCase()} design...`);

    try {
      const prompt = buildRenderPrompt(trade.name, settings, renderGroups);
      const result = await generateAiRender({
        image: uploadedImage,
        prompt,
        tradeId,
      });
      setRenderedImage(result.image);
      toast.success(`${trade.name} design generated!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI render failed';
      toast.error(message);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `${tradeId}-render.png`;

    if (showOverlay && canvasRef.current && canvasRef.current.width > 0) {
      link.href = canvasRef.current.toDataURL('image/png');
    } else if (renderedImage) {
      link.href = renderedImage;
    } else {
      toast.error('Nothing to download yet');
      return;
    }

    link.click();
    toast.success('Image downloaded!');
  };

  if (!tradeId || !trade) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <Sparkles className="w-12 h-12 mx-auto text-purple-600" />
            <h1 className="text-2xl font-bold text-slate-900">AI Design</h1>
            <p className="text-slate-600">
              Speak to the AI assistant to describe the job — it will detect the trade automatically.
            </p>
            <Button className="w-full" onClick={openAssistantWithVoice}>
              <Headphones className="w-4 h-4 mr-2" />
              Talk to AI Assistant
            </Button>
            {!showManualPicker ? (
              <Button variant="ghost" className="w-full" onClick={() => setShowManualPicker(true)}>
                Or pick trade manually
              </Button>
            ) : (
              <Select onValueChange={id => { if (isValidTradeId(id)) { setTradeOverride(id); navigate(`/ai-render/${id}`, { replace: true }); } }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trade" />
                </SelectTrigger>
                <SelectContent>
                  {getAllTrades().map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-2xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                  AI Design — {trade.name}
                </h1>
                <p className="text-amber-100 mt-1 text-lg">Trade-aware photorealistic renders</p>
                {isAiDetected && (
                  <Badge variant="outline" className="mt-2 border-amber-400 text-amber-200">
                    AI suggested this trade
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <Button variant="outline" className="border-white/30 text-white" onClick={openAssistantWithVoice}>
                <Headphones className="w-4 h-4 mr-2" />
                Talk to AI
              </Button>
              {showManualPicker ? (
                <div className="w-full sm:w-56">
                  <Label className="text-amber-200 text-sm mb-1 block">Trade</Label>
                  <Select value={tradeId} onValueChange={handleTradeChange}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllTrades().map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Button variant="outline" className="border-white/30 text-white" onClick={() => setShowManualPicker(true)}>
                  Change trade
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="shadow-xl rounded-3xl border-0">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-t-3xl">
                <CardTitle className="text-2xl">1. Upload Photo</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="photo-upload" />
                <label
                  htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center border-4 border-dashed border-amber-300 rounded-3xl p-12 cursor-pointer hover:border-amber-500 transition-all bg-gradient-to-br from-amber-50 to-amber-100"
                >
                  <Upload className="w-16 h-16 text-amber-600 mb-4" />
                  <p className="text-xl font-bold text-amber-900 mb-2">Click to upload</p>
                  <p className="text-sm text-amber-700">or drag and drop a {trade.name.toLowerCase()} photo</p>
                </label>
                {uploadedImage && (
                  <div className="mt-6">
                    <img src={uploadedImage} alt="Uploaded" className="w-full rounded-2xl shadow-lg" />
                    <p className="text-center text-green-600 font-medium mt-3">✓ Photo uploaded</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xl rounded-3xl border-0">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-3xl">
                <CardTitle className="text-2xl">2. Select Options</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {renderGroups.map(group => (
                  <div key={group.key}>
                    <Label className="text-lg font-bold mb-3 block">{group.label}</Label>
                    <Select
                      value={settings[group.key] ?? group.options[0]?.value}
                      onValueChange={value => setSettings(prev => ({ ...prev, [group.key]: value }))}
                    >
                      <SelectTrigger className="text-lg p-4 border-2 rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {group.options.map(option => (
                          <SelectItem key={option.value} value={option.value} className="text-lg py-3">
                            <div className="flex items-center gap-3">
                              {option.color && (
                                <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: option.color }} />
                              )}
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                <Button
                  onClick={handleRender}
                  disabled={!uploadedImage || isRendering}
                  size="lg"
                  className="w-full text-xl py-6 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 mt-4"
                >
                  {isRendering ? (
                    <>
                      <RefreshCw className="w-6 h-6 mr-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6 mr-3" />
                      Generate AI Render
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-xl rounded-3xl border-0">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-t-3xl">
                <CardTitle className="text-2xl">3. AI Generated Design</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {!renderedImage ? (
                  <div className="aspect-video bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center border-4 border-purple-300">
                    <div className="text-center p-8">
                      <Sparkles className="w-20 h-20 text-purple-400 mx-auto mb-4" />
                      <p className="text-2xl font-bold text-purple-900 mb-2">AI Render Preview</p>
                      <p className="text-purple-700">Upload a photo and click generate</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      {showOverlay ? (
                        <canvas ref={canvasRef} className="w-full rounded-2xl shadow-2xl" />
                      ) : (
                        <img src={renderedImage} alt="Rendered" className="w-full rounded-2xl shadow-2xl" />
                      )}
                      <div className="absolute top-4 right-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-full font-bold shadow-lg">
                        AI Enhanced
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button variant="outline" onClick={() => setShowOverlay(!showOverlay)} className="flex-1 py-4 rounded-2xl">
                        <Layers className="w-5 h-5 mr-2" />
                        {showOverlay ? 'Hide' : 'Show'} Labels
                      </Button>
                      <Button onClick={handleDownload} className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600">
                        <Download className="w-5 h-5 mr-2" />
                        Download
                      </Button>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-300">
                      <h4 className="font-bold text-amber-900 mb-3 text-lg">Selected options:</h4>
                      <div className="space-y-2 text-amber-800">
                        {renderGroups.map(group => {
                          const opt = group.options.find(o => o.value === settings[group.key]);
                          return <p key={group.key}>• {group.label}: {opt?.label ?? settings[group.key]}</p>;
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
