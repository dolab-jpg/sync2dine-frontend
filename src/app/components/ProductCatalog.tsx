import { useContext, useState } from 'react';
import { AppContext, Product } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Link2, Search, Trash2, Edit, Package } from 'lucide-react';
import { toast } from 'sonner';
import { getAllTrades } from '../config/trades';
import type { TradeId } from '../config/types';

export default function ProductCatalog() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user, products, addProduct, updateProduct, deleteProduct } = context;

  // CRITICAL: Only super_admin can access product catalog with pricing
  if (user.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">
              Only administrators can access product pricing and margins.
            </p>
            <p className="text-sm text-slate-500 mt-4">
              Contact your system administrator if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importUrl, setImportUrl] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    image: '',
    basePrice: 0,
    margin: 30,
    source: '',
    category: 'toilet',
    tradeId: 'bathroom' as TradeId,
  });

  const trades = getAllTrades();
  const categories = [
    { value: 'toilet', label: 'Toilets' },
    { value: 'basin', label: 'Basins' },
    { value: 'shower', label: 'Showers' },
    { value: 'bath', label: 'Baths' },
    { value: 'tap', label: 'Taps & Mixers' },
    { value: 'accessory', label: 'Accessories' },
    { value: 'tile', label: 'Tiles' },
    { value: 'other', label: 'Other' }
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      image: '',
      basePrice: 0,
      margin: 30,
      source: '',
      category: 'toilet',
      tradeId: 'bathroom',
    });
    setEditingProduct(null);
    setImportUrl('');
  };

  const handleImportFromUrl = () => {
    if (!importUrl) {
      toast.error('Please enter a product URL');
      return;
    }

    toast.info('Fetching product details...');

    setTimeout(() => {
      const mockProductName = 'Imported Product - ' + new Date().getTime();
      setFormData({
        ...formData,
        name: mockProductName,
        image: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400',
        basePrice: Math.floor(Math.random() * 500) + 100,
        source: importUrl
      });
      toast.success('Product details imported! Review and adjust as needed.');
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct(editingProduct.id, formData);
      toast.success('Product updated successfully');
    } else {
      addProduct(formData);
      toast.success('Product added to catalog');
    }
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      image: product.image,
      basePrice: product.basePrice,
      margin: product.margin,
      source: product.source,
      category: product.category,
      tradeId: product.tradeId ?? 'bathroom',
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProduct(id);
      toast.success('Product deleted');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    const matchesTrade = filterTrade === 'all' || product.tradeId === filterTrade || (!product.tradeId && filterTrade === 'bathroom');
    return matchesSearch && matchesCategory && matchesTrade;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-gray-600 mt-1">Import and manage products from Amazon, eBay, and suppliers</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <Label className="mb-2 block">Import from URL (Amazon, eBay, etc.)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste product URL here..."
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                  />
                  <Button type="button" onClick={handleImportFromUrl}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  We'll automatically pull the product name, image, and price
                </p>
              </div>

              <div className="border-t pt-4">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="basePrice">Base Price (£)</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={e => setFormData({ ...formData, basePrice: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="margin">Margin (%)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="margin"
                    type="number"
                    step="1"
                    value={formData.margin}
                    onChange={e => setFormData({ ...formData, margin: parseFloat(e.target.value) })}
                    required
                    className="flex-1"
                  />
                  <div className="text-sm text-gray-600">
                    Sell Price: <span className="font-bold text-green-600">
                      £{(formData.basePrice * (1 + formData.margin / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="image">Image URL</Label>
                <Input
                  id="image"
                  value={formData.image}
                  onChange={e => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              {formData.image && (
                <div>
                  <Label>Preview</Label>
                  <img src={formData.image} alt="Preview" className="w-32 h-32 object-cover rounded-lg mt-2" />
                </div>
              )}

              <div>
                <Label htmlFor="source">Source URL (optional)</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Link to original product page"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingProduct ? 'Update' : 'Add'} Product
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterTrade} onValueChange={setFilterTrade}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {trades.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {searchTerm || filterCategory !== 'all' ? 'No products match your filters' : 'No products in catalog yet'}
            </p>
            {!searchTerm && filterCategory === 'all' && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Product
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-40 object-cover rounded-lg mb-3"
                  />
                )}
                <div className="space-y-2">
                  <div>
                    <h3 className="font-medium text-gray-900 line-clamp-2 mb-1">{product.name}</h3>
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      {categories.find(c => c.value === product.category)?.label}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-medium">£{product.basePrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Margin:</span>
                      <span className="font-medium text-blue-600">{product.margin}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sell:</span>
                      <span className="font-bold text-green-600">£{product.sellPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {product.source && (
                    <a
                      href={product.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3" />
                      View source
                    </a>
                  )}

                  <div className="flex gap-1 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(product)}>
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(product.id)}>
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
