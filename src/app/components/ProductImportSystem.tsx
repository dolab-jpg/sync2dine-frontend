import { useState, useContext } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ShoppingCart, Link2, RefreshCw, Check, AlertCircle, ExternalLink, Trash2, Edit, Package } from 'lucide-react';
import { toast } from 'sonner';

interface ScrapedProduct {
  name: string;
  image: string;
  price: number;
  url: string;
  source: 'amazon' | 'ebay' | 'supplier';
  asin?: string;
  itemId?: string;
  lastScraped: string;
}

export default function ProductImportSystem() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { products, addProduct, updateProduct, deleteProduct, user } = context;
  const isSuperAdmin = user.role === 'super_admin' || user.role === 'platform_owner';

  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [scrapedProduct, setScrapedProduct] = useState<ScrapedProduct | null>(null);
  const [defaultMargin, setDefaultMargin] = useState(30);
  const [categoryMargins, setCategoryMargins] = useState({
    toilet: 35,
    basin: 35,
    shower: 35,
    tap: 40,
    accessory: 40,
    tile: 30,
    other: 30
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Mock scraping function - in production this would call a backend API
  const scrapeProduct = async (url: string) => {
    setIsImporting(true);

    // Simulate API call to scraping service
    await new Promise(resolve => setTimeout(resolve, 2000));

    let source: 'amazon' | 'ebay' | 'supplier' = 'amazon';
    let mockProduct: ScrapedProduct;

    if (url.includes('amazon')) {
      source = 'amazon';
      mockProduct = {
        name: 'Wall Hung Toilet - Premium White Ceramic with Soft Close Seat',
        image: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400',
        price: 189.99,
        url,
        source,
        asin: 'B08XYZ1234',
        lastScraped: new Date().toISOString()
      };
    } else if (url.includes('ebay')) {
      source = 'ebay';
      mockProduct = {
        name: 'Modern Countertop Basin - Oval White Ceramic',
        image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400',
        price: 124.50,
        url,
        source,
        itemId: '123456789012',
        lastScraped: new Date().toISOString()
      };
    } else {
      source = 'supplier';
      mockProduct = {
        name: 'Thermostatic Shower Mixer - Chrome Finish',
        image: 'https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=400',
        price: 145.00,
        url,
        source,
        lastScraped: new Date().toISOString()
      };
    }

    setScrapedProduct(mockProduct);
    setIsImporting(false);
    setIsPreviewOpen(true);
    toast.success('Product details scraped successfully!');
  };

  const handleImport = () => {
    if (!importUrl) {
      toast.error('Please enter a product URL');
      return;
    }

    if (!importUrl.includes('amazon') && !importUrl.includes('ebay') && !importUrl.includes('http')) {
      toast.error('Please enter a valid Amazon, eBay, or supplier URL');
      return;
    }

    scrapeProduct(importUrl);
  };

  const handleAddToInventory = (category: string) => {
    if (!scrapedProduct) return;

    const margin = categoryMargins[category as keyof typeof categoryMargins] || defaultMargin;
    const sellPrice = scrapedProduct.price * (1 + margin / 100);

    addProduct({
      name: scrapedProduct.name,
      image: scrapedProduct.image,
      basePrice: scrapedProduct.price,
      margin,
      source: scrapedProduct.url,
      category
    });

    toast.success('Product added to inventory!');
    setIsPreviewOpen(false);
    setScrapedProduct(null);
    setImportUrl('');
  };

  const handleRefreshPrices = async () => {
    toast.info('Checking for price updates...');

    // Simulate checking all products for price updates
    await new Promise(resolve => setTimeout(resolve, 3000));

    const updatedCount = Math.floor(Math.random() * 3) + 1;
    toast.success(`${updatedCount} product price(s) updated`);

    // In production, this would:
    // 1. Loop through all products with source URLs
    // 2. Re-scrape each product
    // 3. Update basePrice if changed
    // 4. Recalculate sellPrice with current margin
  };

  const handleUpdateMargin = (category: string, newMargin: number) => {
    setCategoryMargins({
      ...categoryMargins,
      [category]: newMargin
    });

    // Update all products in this category
    const categoryProducts = products.filter(p => p.category === category);
    categoryProducts.forEach(product => {
      updateProduct(product.id, {
        margin: newMargin,
        sellPrice: product.basePrice * (1 + newMargin / 100)
      });
    });

    toast.success(`${category} margin updated to ${newMargin}%`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-2xl">
              <ShoppingCart className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                Product Import System
              </h1>
              <p className="text-amber-100 mt-1 text-lg">Auto-import from Amazon, eBay & suppliers</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="import">
          <TabsList className="grid grid-cols-3 w-full mb-6 bg-white/80 p-2 rounded-2xl shadow-lg">
            <TabsTrigger value="import" className="text-lg py-4 rounded-xl">
              <Link2 className="w-5 h-5 mr-2" />
              Import Product
            </TabsTrigger>
            <TabsTrigger value="margins" className="text-lg py-4 rounded-xl">
              <Package className="w-5 h-5 mr-2" />
              Margin Settings
            </TabsTrigger>
            <TabsTrigger value="sync" className="text-lg py-4 rounded-xl">
              <RefreshCw className="w-5 h-5 mr-2" />
              Price Sync
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-xl rounded-3xl border-0">
                <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-t-3xl">
                  <CardTitle className="text-2xl">Import from URL</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-200">
                    <h3 className="font-bold text-blue-900 mb-2">🛒 Supported Sources</h3>
                    <div className="space-y-2 text-sm text-blue-800">
                      <p>✓ <strong>Amazon UK</strong> - Auto-extracts ASIN, price, images</p>
                      <p>✓ <strong>eBay UK</strong> - Item ID, seller price, photos</p>
                      <p>✓ <strong>Supplier Websites</strong> - Trade catalogues</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xl font-bold mb-3 block">Product URL</Label>
                    <Input
                      value={importUrl}
                      onChange={e => setImportUrl(e.target.value)}
                      placeholder="https://www.amazon.co.uk/dp/B08XYZ1234"
                      className="text-lg p-6 border-2 rounded-2xl mb-3"
                    />
                    <p className="text-sm text-gray-600 mb-4">
                      Paste the full URL from Amazon, eBay, or supplier website
                    </p>

                    <Button
                      onClick={handleImport}
                      disabled={isImporting || !importUrl}
                      size="lg"
                      className="w-full text-xl py-8 rounded-2xl bg-gradient-to-r from-green-500 to-green-600"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-6 h-6 mr-3 animate-spin" />
                          Scraping Product...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-6 h-6 mr-3" />
                          Import Product
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-200">
                    <h4 className="font-bold text-amber-900 mb-3">How It Works</h4>
                    <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
                      <li>Paste product URL from Amazon/eBay</li>
                      <li>System scrapes name, price, and images</li>
                      <li>Preview and select product category</li>
                      <li>Margin automatically applied</li>
                      <li>Product added to your inventory</li>
                      <li>Prices auto-update when scraped again</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xl rounded-3xl border-0">
                <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-3xl">
                  <CardTitle className="text-2xl">Recent Imports</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {products.filter(p => p.source).slice(0, 5).map(product => (
                      <div key={product.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200">
                        <img src={product.image} alt={product.name} className="w-16 h-16 rounded-lg object-cover" />
                        <div className="flex-1">
                          <p className="font-bold text-sm line-clamp-1">{product.name}</p>
                          <p className="text-xs text-gray-600">Cost: £{product.basePrice} • Margin: {product.margin}%</p>
                          <p className="text-sm font-bold text-green-600">Sell: £{product.sellPrice.toFixed(2)}</p>
                        </div>
                        <a href={product.source} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </div>
                    ))}

                    {products.filter(p => p.source).length === 0 && (
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No imported products yet</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Margins Tab */}
          <TabsContent value="margins">
            <Card className="shadow-xl rounded-3xl border-0">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-t-3xl">
                <CardTitle className="text-2xl">Margin Settings by Category</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border-2 border-green-200">
                  <h3 className="font-bold text-green-900 mb-2">💰 Margin Control</h3>
                  <p className="text-green-800 text-sm">
                    Set different profit margins for each product category. When you import a product,
                    the margin is automatically applied based on its category.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(categoryMargins).map(([category, margin]) => {
                    const productCount = products.filter(p => p.category === category).length;
                    const avgCost = products.filter(p => p.category === category)
                      .reduce((sum, p) => sum + p.basePrice, 0) / (productCount || 1);

                    return (
                      <div key={category} className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xl font-bold capitalize">{category}</h4>
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                            {productCount} products
                          </span>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-bold mb-2 block">Margin %</Label>
                            <div className="flex items-center gap-3">
                              <Input
                                type="number"
                                value={margin}
                                onChange={e => handleUpdateMargin(category, parseFloat(e.target.value))}
                                className="text-2xl p-4 border-2 rounded-xl text-center font-bold"
                                disabled={!isSuperAdmin}
                              />
                              <span className="text-3xl font-bold text-gray-600">%</span>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl">
                            <p className="text-sm text-gray-600 mb-2">Example Calculation:</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Avg Cost Price:</span>
                                <span className="font-bold">£{avgCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Margin ({margin}%):</span>
                                <span className="font-bold text-green-600">+£{(avgCost * margin / 100).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1">
                                <span>Sell Price:</span>
                                <span className="font-bold text-xl text-amber-600">
                                  £{(avgCost * (1 + margin / 100)).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {!isSuperAdmin && (
                            <p className="text-xs text-red-600">
                              <AlertCircle className="w-3 h-3 inline mr-1" />
                              Only Super Admin can change margins
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-200">
                  <h4 className="font-bold text-amber-900 mb-3">Default Margin for New Categories</h4>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      value={defaultMargin}
                      onChange={e => setDefaultMargin(parseFloat(e.target.value))}
                      className="text-3xl p-6 border-2 rounded-2xl text-center font-bold w-32"
                      disabled={!isSuperAdmin}
                    />
                    <span className="text-3xl font-bold">%</span>
                    <p className="text-sm text-amber-800 flex-1">
                      Applied to products in categories not listed above
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Price Sync Tab */}
          <TabsContent value="sync">
            <Card className="shadow-xl rounded-3xl border-0">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-t-3xl">
                <CardTitle className="text-2xl">Automatic Price Sync</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-2">🔄 Auto Price Updates</h3>
                  <p className="text-blue-800 text-sm mb-3">
                    Automatically check Amazon/eBay prices daily and update your product costs.
                    Sell prices are recalculated with your current margins.
                  </p>
                  <div className="flex items-center gap-3 mt-4">
                    <input
                      type="checkbox"
                      checked={autoSyncEnabled}
                      onChange={e => setAutoSyncEnabled(e.target.checked)}
                      className="w-6 h-6"
                      id="autoSync"
                    />
                    <Label htmlFor="autoSync" className="text-lg font-bold">
                      Enable automatic daily price sync
                    </Label>
                  </div>
                </div>

                <Button
                  onClick={handleRefreshPrices}
                  size="lg"
                  className="w-full text-2xl py-8 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600"
                >
                  <RefreshCw className="w-6 h-6 mr-3" />
                  Check All Prices Now
                </Button>

                <div className="space-y-3">
                  <h4 className="font-bold text-lg">Products with Source URLs ({products.filter(p => p.source).length})</h4>
                  {products.filter(p => p.source).map(product => (
                    <div key={product.id} className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={product.image} alt={product.name} className="w-12 h-12 rounded object-cover" />
                          <div>
                            <p className="font-bold text-sm">{product.name}</p>
                            <p className="text-xs text-gray-600">
                              Cost: £{product.basePrice} • Sell: £{product.sellPrice.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-600" />
                          <span className="text-xs text-green-600">Synced</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-200">
                  <h4 className="font-bold text-amber-900 mb-3">💡 How Price Sync Works</h4>
                  <ul className="text-sm text-amber-800 space-y-2">
                    <li>• System re-scrapes all products with source URLs</li>
                    <li>• Compares new price with stored cost price</li>
                    <li>• Updates cost if changed (maintains margin %)</li>
                    <li>• Recalculates sell price automatically</li>
                    <li>• Notifications sent if prices change significantly</li>
                    <li>• Run manually or enable daily auto-sync</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Modal */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl">
            {scrapedProduct && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-3xl">Product Preview</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <img src={scrapedProduct.image} alt={scrapedProduct.name} className="w-full rounded-2xl shadow-lg" />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="font-bold">Product Name</Label>
                        <p className="mt-1 text-lg">{scrapedProduct.name}</p>
                      </div>

                      <div>
                        <Label className="font-bold">Source</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="capitalize font-medium">{scrapedProduct.source}</span>
                          {scrapedProduct.asin && <span className="text-xs text-gray-600">ASIN: {scrapedProduct.asin}</span>}
                          {scrapedProduct.itemId && <span className="text-xs text-gray-600">Item: {scrapedProduct.itemId}</span>}
                        </div>
                      </div>

                      <div>
                        <Label className="font-bold">Cost Price</Label>
                        <p className="mt-1 text-3xl font-bold text-blue-600">£{scrapedProduct.price.toFixed(2)}</p>
                      </div>

                      <div>
                        <Label className="font-bold mb-2 block">Select Category</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(categoryMargins).map(([category, margin]) => {
                            const sellPrice = scrapedProduct.price * (1 + margin / 100);
                            return (
                              <Button
                                key={category}
                                onClick={() => handleAddToInventory(category)}
                                variant="outline"
                                className="flex flex-col items-start p-4 h-auto"
                              >
                                <span className="font-bold capitalize">{category}</span>
                                <span className="text-xs text-gray-600">{margin}% margin</span>
                                <span className="text-sm font-bold text-green-600">Sell: £{sellPrice.toFixed(2)}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-2xl border-2 border-green-200">
                    <p className="text-sm text-green-800">
                      <Check className="w-4 h-4 inline mr-1" />
                      Product scraped successfully. Select a category to add to inventory.
                    </p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
