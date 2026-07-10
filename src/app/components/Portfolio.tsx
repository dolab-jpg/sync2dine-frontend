import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Image, Plus, Play, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TradeId } from '../config/types';
import { getAllTrades, getTrade } from '../config/trades';
import { loadPortfolioProjects, savePortfolioProjects, type PortfolioProject } from '../data/portfolioSeed';
import { loadPortfolioEntries } from '../engine/project/completionService';

function getCategoryLabel(tradeId: TradeId, categoryValue: string): string {
  return getTrade(tradeId).portfolioCategories.find(c => c.value === categoryValue)?.label ?? categoryValue;
}

export default function Portfolio() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user } = context;
  const isSuperAdmin = user.role === 'super_admin';
  const trades = getAllTrades();

  const [selectedTradeId, setSelectedTradeId] = useState<TradeId>('bathroom');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [projects, setProjects] = useState<PortfolioProject[]>(() => {
    const seed = loadPortfolioProjects();
    const completed = loadPortfolioEntries().map((e: { id: string; title: string; tradeName?: string; beforePhotos?: string[]; afterPhotos?: string[]; completedAt?: string }) => ({
      id: e.id,
      title: e.title,
      tradeId: 'bathroom' as TradeId,
      category: 'complete',
      before: e.beforePhotos?.[0] ?? '',
      after: e.afterPhotos?.[0] ?? '',
      description: `Completed ${e.tradeName ?? 'project'}`,
      cost: '',
      featured: false,
    }));
    return [...completed, ...seed];
  });
  const [showingBefore, setShowingBefore] = useState<Record<string, boolean>>({});

  const tradeConfig = getTrade(selectedTradeId);

  const categories = useMemo(
    () => [
      { value: 'all', label: 'All Projects' },
      ...tradeConfig.portfolioCategories,
    ],
    [tradeConfig]
  );

  const defaultCategory = tradeConfig.portfolioCategories[0]?.value ?? 'complete';

  const [formData, setFormData] = useState({
    title: '',
    category: defaultCategory,
    before: '',
    after: '',
    description: '',
    cost: '',
  });

  const filteredProjects = projects.filter(p => {
    if (p.tradeId !== selectedTradeId) return false;
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  const tradeProjectCount = projects.filter(p => p.tradeId === selectedTradeId).length;

  const handleTradeChange = (tradeId: TradeId) => {
    setSelectedTradeId(tradeId);
    setSelectedCategory('all');
    const firstCat = getTrade(tradeId).portfolioCategories[0]?.value ?? '';
    setFormData(prev => ({ ...prev, category: firstCat }));
  };

  const toggleImage = (id: string) => {
    setShowingBefore(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleImageUpload = (field: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        setFormData({ ...formData, [field]: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const persist = (next: PortfolioProject[]) => {
    setProjects(next);
    savePortfolioProjects(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newProject: PortfolioProject = {
      ...formData,
      id: Date.now().toString(),
      tradeId: selectedTradeId,
    };
    persist([...projects, newProject]);
    setFormData({
      title: '',
      category: tradeConfig.portfolioCategories[0]?.value ?? '',
      before: '',
      after: '',
      description: '',
      cost: '',
    });
    setIsAddDialogOpen(false);
    toast.success('Project added to portfolio');
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      persist(projects.filter(p => p.id !== id));
      toast.success('Project deleted');
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Portfolio & Showcase</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Show customers your best {tradeConfig.name.toLowerCase()} work and inspire confidence
          </p>
        </div>

        {isSuperAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto min-h-11 shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Portfolio Project — {tradeConfig.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="min-h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={value => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger className="min-h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tradeConfig.portfolioCategories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cost">Project Cost</Label>
                    <Input
                      id="cost"
                      value={formData.cost}
                      onChange={e => setFormData({ ...formData, cost: e.target.value })}
                      placeholder="£8,500"
                      required
                      className="min-h-11"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Before Photo</Label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload('before', e)}
                      className="hidden"
                      id="before-upload"
                    />
                    <label
                      htmlFor="before-upload"
                      className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-blue-500 min-h-[8rem]"
                    >
                      {formData.before ? (
                        <img src={formData.before} alt="Before" className="w-full h-32 object-cover rounded" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">Upload Before</span>
                        </>
                      )}
                    </label>
                  </div>

                  <div>
                    <Label>After Photo</Label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload('after', e)}
                      className="hidden"
                      id="after-upload"
                    />
                    <label
                      htmlFor="after-upload"
                      className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-blue-500 min-h-[8rem]"
                    >
                      {formData.after ? (
                        <img src={formData.after} alt="After" className="w-full h-32 object-cover rounded" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">Upload After</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="min-h-11">
                    Add Project
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Trade picker */}
      <div className="mb-4 overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-2 w-max min-w-full sm:flex-wrap">
          {trades.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTradeChange(t.id)}
              className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-11 touch-manipulation ${
                selectedTradeId === t.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-6 overflow-x-auto -mx-1 px-1 pb-1">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-max min-w-full flex-nowrap h-auto gap-1">
            {categories.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="min-h-10 shrink-0">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative aspect-video cursor-pointer" onClick={() => toggleImage(project.id)}>
                <img
                  src={showingBefore[project.id] ? project.before : project.after}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {showingBefore[project.id] ? 'Before' : 'After'}
                </div>
                <div className="absolute bottom-3 right-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/90 hover:bg-white min-h-9"
                    onClick={e => {
                      e.stopPropagation();
                      toggleImage(project.id);
                    }}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Toggle
                  </Button>
                </div>
                {isSuperAdmin && (
                  <div className="absolute top-3 right-3">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="min-h-9 min-w-9"
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{project.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">{project.description}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded truncate">
                    {getCategoryLabel(project.tradeId, project.category)}
                  </span>
                  <span className="font-bold text-green-600 shrink-0">{project.cost}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {selectedCategory === 'all'
                ? `No ${tradeConfig.name.toLowerCase()} projects yet`
                : 'No projects in this category yet'}
            </p>
            {isSuperAdmin && (
              <Button onClick={() => setIsAddDialogOpen(true)} className="min-h-11 mt-2">
                <Plus className="w-4 h-4 mr-2" />
                Add {tradeConfig.name} Project
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 text-white p-3 rounded-lg shrink-0">
              <Image className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg mb-2">Use Portfolio in Sales</h3>
              <p className="text-gray-700 mb-4 text-sm sm:text-base">
                Show this portfolio to customers on-site to build trust. Pick the trade that matches
                their job, then tap Toggle to compare before and after photos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-white p-3 rounded">
                  <p className="font-medium mb-1">{tradeProjectCount} {tradeConfig.name} projects</p>
                  <p className="text-gray-600 text-xs">In this trade showcase</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="font-medium mb-1">Builds Trust</p>
                  <p className="text-gray-600 text-xs">Proven track record</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="font-medium mb-1">Closes Deals</p>
                  <p className="text-gray-600 text-xs">Visual proof of quality</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
