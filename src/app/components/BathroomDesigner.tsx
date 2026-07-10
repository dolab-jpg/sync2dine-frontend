import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Upload, Sparkles, Download, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function BathroomDesigner() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedDesign, setGeneratedDesign] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [designOptions, setDesignOptions] = useState({
    finish: 'microcement-grey',
    toilet: 'wall-hung-white',
    basin: 'countertop-white',
    shower: 'walk-in-frameless',
    lighting: 'recessed-led',
    extras: [] as string[]
  });

  const finishOptions = [
    { value: 'microcement-grey', label: 'Microcement - Grey' },
    { value: 'microcement-white', label: 'Microcement - White' },
    { value: 'microcement-beige', label: 'Microcement - Beige' },
    { value: 'microcement-charcoal', label: 'Microcement - Charcoal' },
    { value: 'tile-marble', label: 'Marble Effect Tiles' },
    { value: 'tile-wood', label: 'Wood Effect Tiles' }
  ];

  const toiletOptions = [
    { value: 'wall-hung-white', label: 'Wall Hung - White' },
    { value: 'back-to-wall-white', label: 'Back to Wall - White' },
    { value: 'close-coupled-white', label: 'Close Coupled - White' }
  ];

  const basinOptions = [
    { value: 'countertop-white', label: 'Countertop Basin - White' },
    { value: 'wall-hung-white', label: 'Wall Hung Basin - White' },
    { value: 'pedestal-white', label: 'Pedestal Basin - White' },
    { value: 'vanity-unit', label: 'Vanity Unit with Basin' }
  ];

  const showerOptions = [
    { value: 'walk-in-frameless', label: 'Walk-in Frameless' },
    { value: 'quadrant-enclosure', label: 'Quadrant Enclosure' },
    { value: 'bath-screen', label: 'Bath with Screen' }
  ];

  const lightingOptions = [
    { value: 'recessed-led', label: 'Recessed LED Spotlights' },
    { value: 'wall-sconces', label: 'Wall Sconces' },
    { value: 'strip-lighting', label: 'LED Strip Lighting' }
  ];

  const extrasOptions = [
    { value: 'niche', label: 'Shower Niche' },
    { value: 'shelf', label: 'Glass Shelf' },
    { value: 'heated-towel', label: 'Heated Towel Rail' },
    { value: 'mirror-cabinet', label: 'Mirror Cabinet' }
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setGeneratedDesign(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = () => {
    if (!uploadedImage) {
      toast.error('Please upload a bathroom photo first');
      return;
    }

    setIsGenerating(true);

    setTimeout(() => {
      setGeneratedDesign(uploadedImage);
      setIsGenerating(false);
      toast.success('Design generated! (This is a mockup - real version would use AI)');
    }, 2000);
  };

  const handleSaveDesign = () => {
    toast.success('Design saved to portfolio');
  };

  const toggleExtra = (extra: string) => {
    setDesignOptions(prev => ({
      ...prev,
      extras: prev.extras.includes(extra)
        ? prev.extras.filter(e => e !== extra)
        : [...prev.extras, extra]
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Bathroom Designer</h1>
        <p className="text-gray-600 mt-1">Upload a photo and create stunning visual designs for your customers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Upload Bathroom Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-400">PNG, JPG up to 10MB</p>
                </label>
              </div>

              {uploadedImage && (
                <div className="mt-4">
                  <img src={uploadedImage} alt="Uploaded" className="w-full rounded-lg" />
                  <p className="text-sm text-green-600 mt-2">✓ Photo uploaded successfully</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Select Finishes & Products</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="finish" className="w-full">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="finish">Finish</TabsTrigger>
                  <TabsTrigger value="products">Products</TabsTrigger>
                  <TabsTrigger value="extras">Extras</TabsTrigger>
                </TabsList>

                <TabsContent value="finish" className="space-y-4 mt-4">
                  <div>
                    <Label>Wall & Floor Finish</Label>
                    <Select value={designOptions.finish} onValueChange={(value) => setDesignOptions({ ...designOptions, finish: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {finishOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Lighting</Label>
                    <Select value={designOptions.lighting} onValueChange={(value) => setDesignOptions({ ...designOptions, lighting: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {lightingOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="products" className="space-y-4 mt-4">
                  <div>
                    <Label>Toilet</Label>
                    <Select value={designOptions.toilet} onValueChange={(value) => setDesignOptions({ ...designOptions, toilet: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {toiletOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Basin</Label>
                    <Select value={designOptions.basin} onValueChange={(value) => setDesignOptions({ ...designOptions, basin: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {basinOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Shower/Bath</Label>
                    <Select value={designOptions.shower} onValueChange={(value) => setDesignOptions({ ...designOptions, shower: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {showerOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="extras" className="mt-4">
                  <Label className="mb-3 block">Additional Features</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {extrasOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleExtra(option.value)}
                        className={`p-3 rounded-lg border-2 text-sm transition-colors ${
                          designOptions.extras.includes(option.value)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={!uploadedImage || isGenerating}
            className="w-full"
            size="lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {isGenerating ? 'Generating Design...' : 'Generate AI Design'}
          </Button>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Generated Design Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {!generatedDesign ? (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Your AI-generated design will appear here</p>
                    <p className="text-sm text-gray-400 mt-2">Upload a photo and select options to begin</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <img src={generatedDesign} alt="Generated design" className="w-full rounded-lg" />
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      AI Enhanced
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Design Summary</h4>
                    <div className="space-y-1 text-sm text-blue-800">
                      <p>• Finish: {finishOptions.find(o => o.value === designOptions.finish)?.label}</p>
                      <p>• Toilet: {toiletOptions.find(o => o.value === designOptions.toilet)?.label}</p>
                      <p>• Basin: {basinOptions.find(o => o.value === designOptions.basin)?.label}</p>
                      <p>• Shower: {showerOptions.find(o => o.value === designOptions.shower)?.label}</p>
                      <p>• Lighting: {lightingOptions.find(o => o.value === designOptions.lighting)?.label}</p>
                      {designOptions.extras.length > 0 && (
                        <p>• Extras: {designOptions.extras.map(e => extrasOptions.find(o => o.value === e)?.label).join(', ')}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveDesign} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      Save to Portfolio
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    Note: This is a mockup. Real implementation would use AI image generation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
