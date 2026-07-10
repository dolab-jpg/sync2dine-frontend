import { useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ChevronLeft, ChevronRight, Check, Sparkles, Home } from 'lucide-react';
import { toast } from 'sonner';

export default function QuoteBuilderV2() {
  const context = useContext(AppContext);
  const { customerId } = useParams();
  const navigate = useNavigate();

  if (!context) return null;

  const { customers, products, pricingRules, addQuote } = context;

  const [currentStage, setCurrentStage] = useState(0);
  const [quoteData, setQuoteData] = useState({
    customerId: customerId || '',
    customerName: '',

    // Measurements
    length: '',
    width: '',
    height: '',
    area: 0,

    // Finish Selection
    finish: 'microcement-grey',
    finishPrice: 85,

    // Second Fix Products
    toilet: '',
    basin: '',
    shower: '',
    taps: '',

    // Additions
    additions: [] as string[],

    // Site Conditions
    floorLocation: 'ground',
    access: 'easy',
    removal: 'standard',

    // Pricing
    labourDays: 0,
    labourRate: 250,
    materialsTotal: 0,
    removalCost: 450,
    discount: 0,

    bookingDeposit: 500,
    bookingDate: ''
  });

  useEffect(() => {
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setQuoteData(prev => ({
          ...prev,
          customerId,
          customerName: customer.name
        }));
      }
    }
  }, [customerId, customers]);

  const finishes = [
    { value: 'microcement-grey', label: 'Microcement - Grey', price: 85 },
    { value: 'microcement-white', label: 'Microcement - White', price: 85 },
    { value: 'microcement-beige', label: 'Microcement - Beige', price: 90 },
    { value: 'microcement-charcoal', label: 'Microcement - Charcoal', price: 95 },
    { value: 'tiles-marble', label: 'Marble Effect Tiles', price: 65 },
    { value: 'tiles-porcelain', label: 'Large Format Porcelain', price: 70 }
  ];

  const secondFixProducts = {
    toilets: products.filter(p => p.category === 'toilet'),
    basins: products.filter(p => p.category === 'basin'),
    showers: products.filter(p => p.category === 'shower'),
    taps: products.filter(p => p.category === 'tap')
  };

  const additionsOptions = [
    { id: 'niche', name: 'Shower Niche', price: 180 },
    { id: 'shelf', name: 'Glass Shelf', price: 120 },
    { id: 'heated-rail', name: 'Heated Towel Rail', price: 320 },
    { id: 'mirror-cabinet', name: 'LED Mirror Cabinet', price: 280 },
    { id: 'floor-heating', name: 'Underfloor Heating', price: 450 },
    { id: 'lighting-led', name: 'LED Strip Lighting', price: 180 }
  ];

  const updateMeasurements = (field: string, value: string) => {
    const updated = { ...quoteData, [field]: value };

    if (updated.length && updated.width) {
      const area = parseFloat(updated.length) * parseFloat(updated.width);
      updated.area = area;

      // Auto-calculate labour days based on area
      const days = Math.ceil(area / 5) + 2; // Rough estimate: 5m² per day + 2 days prep
      updated.labourDays = days;
    }

    setQuoteData(updated);
  };

  const toggleAddition = (additionId: string) => {
    setQuoteData(prev => ({
      ...prev,
      additions: prev.additions.includes(additionId)
        ? prev.additions.filter(id => id !== additionId)
        : [...prev.additions, additionId]
    }));
  };

  const calculateTotals = () => {
    const { area, finish, toilet, basin, shower, taps, additions, floorLocation, access, removal, labourDays, labourRate } = quoteData;

    // Finish cost (per m²)
    const selectedFinish = finishes.find(f => f.value === finish);
    const finishCost = area * (selectedFinish?.price || 0);

    // Products cost
    const toiletProduct = products.find(p => p.id === toilet);
    const basinProduct = products.find(p => p.id === basin);
    const showerProduct = products.find(p => p.id === shower);
    const tapsProduct = products.find(p => p.id === taps);

    const productsCost = (toiletProduct?.sellPrice || 0) +
                         (basinProduct?.sellPrice || 0) +
                         (showerProduct?.sellPrice || 0) +
                         (tapsProduct?.sellPrice || 0);

    // Additions cost
    const additionsCost = additions.reduce((sum, addId) => {
      const addition = additionsOptions.find(a => a.id === addId);
      return sum + (addition?.price || 0);
    }, 0);

    // Labour cost
    const labourCost = labourDays * labourRate;

    // Materials (waterproofing, adhesive, grout, etc.)
    const materialsCost = area * 25; // £25 per m² for materials

    // Removal cost
    let removalCost = 450;
    if (removal === 'heavy') removalCost = 750;

    // Access adjustments
    let accessAdjustment = 0;
    if (floorLocation === 'upstairs') accessAdjustment = 200;
    if (floorLocation === 'loft') accessAdjustment = 400;
    if (access === 'limited') accessAdjustment += 150;
    if (access === 'difficult') accessAdjustment += 300;

    const subtotal = finishCost + productsCost + additionsCost + labourCost + materialsCost + removalCost + accessAdjustment;
    const discountAmount = subtotal * (quoteData.discount / 100);
    const total = subtotal - discountAmount;

    return {
      finishCost,
      productsCost,
      additionsCost,
      labourCost,
      materialsCost,
      removalCost,
      accessAdjustment,
      subtotal,
      discountAmount,
      total
    };
  };

  const totals = calculateTotals();

  const handleComplete = () => {
    const customer = customers.find(c => c.id === quoteData.customerId);
    if (!customer) {
      toast.error('Please select a customer');
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const selectedFinish = finishes.find(f => f.value === quoteData.finish);
    const toiletProduct = products.find(p => p.id === quoteData.toilet);
    const basinProduct = products.find(p => p.id === quoteData.basin);
    const showerProduct = products.find(p => p.id === quoteData.shower);
    const tapsProduct = products.find(p => p.id === quoteData.taps);

    const items = [
      ...(selectedFinish && quoteData.area > 0
        ? [{
            productId: quoteData.finish,
            name: `${selectedFinish.label} (${quoteData.area.toFixed(1)}m²)`,
            quantity: quoteData.area,
            price: selectedFinish.price,
            total: totals.finishCost,
          }]
        : []),
      ...(toiletProduct
        ? [{ productId: toiletProduct.id, name: toiletProduct.name, quantity: 1, price: toiletProduct.sellPrice, total: toiletProduct.sellPrice }]
        : []),
      ...(basinProduct
        ? [{ productId: basinProduct.id, name: basinProduct.name, quantity: 1, price: basinProduct.sellPrice, total: basinProduct.sellPrice }]
        : []),
      ...(showerProduct
        ? [{ productId: showerProduct.id, name: showerProduct.name, quantity: 1, price: showerProduct.sellPrice, total: showerProduct.sellPrice }]
        : []),
      ...(tapsProduct
        ? [{ productId: tapsProduct.id, name: tapsProduct.name, quantity: 1, price: tapsProduct.sellPrice, total: tapsProduct.sellPrice }]
        : []),
    ];

    const labour = quoteData.labourDays > 0
      ? [{
          description: `Labour (${quoteData.labourDays} days @ £${quoteData.labourRate}/day)`,
          days: quoteData.labourDays,
          rateType: 'per_day' as const,
          rate: quoteData.labourRate,
          total: totals.labourCost,
        }]
      : [];

    const extras = [
      ...(totals.materialsCost > 0
        ? [{ description: `Materials & First Fix (${quoteData.area.toFixed(1)}m²)`, price: totals.materialsCost }]
        : []),
      { description: 'Waste Removal', price: totals.removalCost },
      ...(totals.accessAdjustment > 0
        ? [{ description: 'Access & Location', price: totals.accessAdjustment }]
        : []),
      ...quoteData.additions.map(addId => {
        const addition = additionsOptions.find(a => a.id === addId);
        return addition ? { description: addition.name, price: addition.price } : null;
      }).filter((item): item is { description: string; price: number } => item !== null),
    ];

    addQuote({
      customerId: quoteData.customerId,
      customerName: customer.name,
      expiresAt: expiresAt.toISOString(),
      items,
      labour,
      extras,
      discount: quoteData.discount,
      total: totals.total,
      status: 'draft'
    });

    toast.success('Quote created successfully! Redirecting to quotes list...');
    navigate('/quotes');
  };

  const stages = [
    { title: 'Customer', icon: Home },
    { title: 'Measurements', icon: Home },
    { title: 'Finish', icon: Sparkles },
    { title: 'Products', icon: Home },
    { title: 'Additions', icon: Home },
    { title: 'Site Details', icon: Home },
    { title: 'Summary', icon: Check }
  ];

  const OptionCard = ({ selected, onClick, children, price }: { selected: boolean; onClick: () => void; children: React.ReactNode; price?: number }) => (
    <button
      onClick={onClick}
      className={`w-full p-6 rounded-2xl border-3 transition-all text-left ${
        selected
          ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 shadow-lg scale-105'
          : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">{children}</div>
        {selected && (
          <div className="ml-4 bg-amber-500 text-white rounded-full p-2">
            <Check className="w-6 h-6" />
          </div>
        )}
      </div>
      {price !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <span className="text-2xl font-bold text-amber-700">£{price.toFixed(0)}</span>
        </div>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Progress Bar */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 shadow-xl">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-xl">Stage {currentStage + 1} of {stages.length}</h2>
            <span className="text-amber-100 text-sm">{stages[currentStage].title}</span>
          </div>
          <div className="w-full bg-amber-800 rounded-full h-4 overflow-hidden">
            <div
              className="bg-white h-4 transition-all duration-500 rounded-full"
              style={{ width: `${((currentStage + 1) / stages.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <Card className="bg-white/95 backdrop-blur shadow-2xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-8">
            <CardTitle className="text-3xl font-bold">{stages[currentStage].title}</CardTitle>
          </CardHeader>
          <CardContent className="p-8 min-h-[500px]">
            {/* Stage 0: Customer Selection */}
            {currentStage === 0 && (
              <div className="space-y-6">
                <Label className="text-2xl font-bold text-slate-800">Select Customer</Label>
                <Select value={quoteData.customerId} onValueChange={(value) => {
                  const customer = customers.find(c => c.id === value);
                  setQuoteData({ ...quoteData, customerId: value, customerName: customer?.name || '' });
                }}>
                  <SelectTrigger className="text-2xl p-8 border-2 rounded-2xl">
                    <SelectValue placeholder="Choose a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id} className="text-xl py-6">
                        <div>
                          <div className="font-bold">{customer.name}</div>
                          <div className="text-sm text-gray-600">{customer.address}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Stage 1: Measurements */}
            {currentStage === 1 && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-200">
                  <h3 className="text-xl font-bold text-blue-900 mb-2">Room Dimensions</h3>
                  <p className="text-blue-700">Measure the bathroom dimensions</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xl font-bold mb-3 block">Length (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={quoteData.length}
                      onChange={e => updateMeasurements('length', e.target.value)}
                      className="text-4xl p-8 border-3 rounded-2xl text-center font-bold"
                      placeholder="3.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xl font-bold mb-3 block">Width (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={quoteData.width}
                      onChange={e => updateMeasurements('width', e.target.value)}
                      className="text-4xl p-8 border-3 rounded-2xl text-center font-bold"
                      placeholder="2.5"
                    />
                  </div>
                </div>

                {quoteData.area > 0 && (
                  <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-8 rounded-3xl text-white text-center shadow-2xl">
                    <p className="text-xl mb-2 opacity-90">Total Area</p>
                    <p className="text-6xl font-bold">{quoteData.area.toFixed(1)} m²</p>
                    <p className="text-lg mt-4 opacity-90">Estimated {quoteData.labourDays} days labour</p>
                  </div>
                )}
              </div>
            )}

            {/* Stage 2: Finish Selection */}
            {currentStage === 2 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border-2 border-purple-200">
                  <h3 className="text-xl font-bold text-purple-900 mb-2">Choose Wall & Floor Finish</h3>
                  <p className="text-purple-700">Select the premium finish for this bathroom</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {finishes.map(finish => (
                    <OptionCard
                      key={finish.value}
                      selected={quoteData.finish === finish.value}
                      onClick={() => setQuoteData({ ...quoteData, finish: finish.value, finishPrice: finish.price })}
                    >
                      <div className="text-2xl font-bold text-slate-800">{finish.label}</div>
                      <div className="text-lg text-slate-600 mt-1">
                        £{finish.price}/m² • Total: £{(finish.price * quoteData.area).toFixed(0)}
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </div>
            )}

            {/* Stage 3: Second Fix Products */}
            {currentStage === 3 && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border-2 border-green-200">
                  <h3 className="text-xl font-bold text-green-900 mb-2">Second Fix Products</h3>
                  <p className="text-green-700">First fix (plumbing, waterproofing) included in labour</p>
                </div>

                <div className="space-y-8">
                  {/* Toilet */}
                  <div>
                    <Label className="text-xl font-bold mb-4 block">Toilet</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {secondFixProducts.toilets.map(product => (
                        <button
                          key={product.id}
                          onClick={() => setQuoteData({ ...quoteData, toilet: product.id })}
                          className={`relative p-4 rounded-2xl border-2 transition-all ${
                            quoteData.toilet === product.id
                              ? 'border-amber-500 bg-amber-50 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {product.image && (
                            <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                          )}
                          <h4 className="font-semibold text-left mb-1">{product.name}</h4>
                          <p className="text-lg font-bold text-amber-600">£{product.sellPrice.toFixed(0)}</p>
                          {quoteData.toilet === product.id && (
                            <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full p-1">
                              <Check className="w-5 h-5" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Basin */}
                  <div>
                    <Label className="text-xl font-bold mb-4 block">Basin</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {secondFixProducts.basins.map(product => (
                        <button
                          key={product.id}
                          onClick={() => setQuoteData({ ...quoteData, basin: product.id })}
                          className={`relative p-4 rounded-2xl border-2 transition-all ${
                            quoteData.basin === product.id
                              ? 'border-amber-500 bg-amber-50 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {product.image && (
                            <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                          )}
                          <h4 className="font-semibold text-left mb-1">{product.name}</h4>
                          <p className="text-lg font-bold text-amber-600">£{product.sellPrice.toFixed(0)}</p>
                          {quoteData.basin === product.id && (
                            <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full p-1">
                              <Check className="w-5 h-5" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shower */}
                  <div>
                    <Label className="text-xl font-bold mb-4 block">Shower</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {secondFixProducts.showers.map(product => (
                        <button
                          key={product.id}
                          onClick={() => setQuoteData({ ...quoteData, shower: product.id })}
                          className={`relative p-4 rounded-2xl border-2 transition-all ${
                            quoteData.shower === product.id
                              ? 'border-amber-500 bg-amber-50 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {product.image && (
                            <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                          )}
                          <h4 className="font-semibold text-left mb-1">{product.name}</h4>
                          <p className="text-lg font-bold text-amber-600">£{product.sellPrice.toFixed(0)}</p>
                          {quoteData.shower === product.id && (
                            <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full p-1">
                              <Check className="w-5 h-5" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Taps */}
                  <div>
                    <Label className="text-xl font-bold mb-4 block">Taps & Mixer</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {secondFixProducts.taps.map(product => (
                        <button
                          key={product.id}
                          onClick={() => setQuoteData({ ...quoteData, taps: product.id })}
                          className={`relative p-4 rounded-2xl border-2 transition-all ${
                            quoteData.taps === product.id
                              ? 'border-amber-500 bg-amber-50 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {product.image && (
                            <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                          )}
                          <h4 className="font-semibold text-left mb-1">{product.name}</h4>
                          <p className="text-lg font-bold text-amber-600">£{product.sellPrice.toFixed(0)}</p>
                          {quoteData.taps === product.id && (
                            <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full p-1">
                              <Check className="w-5 h-5" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 4: Additions */}
            {currentStage === 4 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-2xl border-2 border-indigo-200">
                  <h3 className="text-xl font-bold text-indigo-900 mb-2">Premium Additions</h3>
                  <p className="text-indigo-700">Select any additional features</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {additionsOptions.map(addition => (
                    <button
                      key={addition.id}
                      onClick={() => toggleAddition(addition.id)}
                      className={`p-6 rounded-2xl border-3 transition-all text-left ${
                        quoteData.additions.includes(addition.id)
                          ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-indigo-100 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xl font-bold text-slate-800">{addition.name}</div>
                          <div className="text-lg text-amber-600 font-bold mt-1">+£{addition.price}</div>
                        </div>
                        {quoteData.additions.includes(addition.id) && (
                          <div className="bg-indigo-500 text-white rounded-full p-2">
                            <Check className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stage 5: Site Details */}
            {currentStage === 5 && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl border-2 border-orange-200">
                  <h3 className="text-xl font-bold text-orange-900 mb-2">Site Conditions</h3>
                  <p className="text-orange-700">These affect labour and access costs</p>
                </div>

                <div>
                  <Label className="text-xl font-bold mb-4 block">Floor Location</Label>
                  <div className="grid grid-cols-1 gap-4">
                    <OptionCard
                      selected={quoteData.floorLocation === 'ground'}
                      onClick={() => setQuoteData({ ...quoteData, floorLocation: 'ground' })}
                    >
                      <div className="text-2xl font-bold">Ground Floor</div>
                      <div className="text-lg text-gray-600 mt-1">No additional cost</div>
                    </OptionCard>
                    <OptionCard
                      selected={quoteData.floorLocation === 'upstairs'}
                      onClick={() => setQuoteData({ ...quoteData, floorLocation: 'upstairs' })}
                    >
                      <div className="text-2xl font-bold">Upstairs</div>
                      <div className="text-lg text-amber-600 mt-1">+£200 access charge</div>
                    </OptionCard>
                    <OptionCard
                      selected={quoteData.floorLocation === 'loft'}
                      onClick={() => setQuoteData({ ...quoteData, floorLocation: 'loft' })}
                    >
                      <div className="text-2xl font-bold">Loft/Attic</div>
                      <div className="text-lg text-amber-600 mt-1">+£400 access charge</div>
                    </OptionCard>
                  </div>
                </div>

                <div>
                  <Label className="text-xl font-bold mb-4 block">Parking & Access</Label>
                  <div className="grid grid-cols-1 gap-4">
                    <OptionCard
                      selected={quoteData.access === 'easy'}
                      onClick={() => setQuoteData({ ...quoteData, access: 'easy' })}
                    >
                      <div className="text-2xl font-bold">Easy Access</div>
                      <div className="text-lg text-gray-600 mt-1">Good parking, clear access</div>
                    </OptionCard>
                    <OptionCard
                      selected={quoteData.access === 'limited'}
                      onClick={() => setQuoteData({ ...quoteData, access: 'limited' })}
                    >
                      <div className="text-2xl font-bold">Limited Access</div>
                      <div className="text-lg text-amber-600 mt-1">+£150 (restricted parking)</div>
                    </OptionCard>
                    <OptionCard
                      selected={quoteData.access === 'difficult'}
                      onClick={() => setQuoteData({ ...quoteData, access: 'difficult' })}
                    >
                      <div className="text-2xl font-bold">Difficult Access</div>
                      <div className="text-lg text-amber-600 mt-1">+£300 (very limited access)</div>
                    </OptionCard>
                  </div>
                </div>

                <div>
                  <Label className="text-xl font-bold mb-4 block">Waste Removal</Label>
                  <div className="grid grid-cols-1 gap-4">
                    <OptionCard
                      selected={quoteData.removal === 'standard'}
                      onClick={() => setQuoteData({ ...quoteData, removal: 'standard' })}
                    >
                      <div className="text-2xl font-bold">Standard Bathroom</div>
                      <div className="text-lg text-gray-600 mt-1">£450 disposal included</div>
                    </OptionCard>
                    <OptionCard
                      selected={quoteData.removal === 'heavy'}
                      onClick={() => setQuoteData({ ...quoteData, removal: 'heavy' })}
                    >
                      <div className="text-2xl font-bold">Heavy Removal</div>
                      <div className="text-lg text-amber-600 mt-1">£750 (cast iron bath, heavy tiles)</div>
                    </OptionCard>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 6: Summary */}
            {currentStage === 6 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 rounded-3xl text-white text-center shadow-2xl">
                  <p className="text-2xl mb-2 opacity-90">Total Project Cost</p>
                  <p className="text-7xl font-bold">£{totals.total.toFixed(0)}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-2xl space-y-4">
                  <h3 className="text-2xl font-bold text-slate-800 mb-4">Breakdown</h3>

                  <div className="flex justify-between text-lg py-3 border-b">
                    <span className="text-slate-600">Finish ({quoteData.area.toFixed(1)}m²)</span>
                    <span className="font-bold">£{totals.finishCost.toFixed(0)}</span>
                  </div>

                  <div className="flex justify-between text-lg py-3 border-b">
                    <span className="text-slate-600">Products (Second Fix)</span>
                    <span className="font-bold">£{totals.productsCost.toFixed(0)}</span>
                  </div>

                  {totals.additionsCost > 0 && (
                    <div className="flex justify-between text-lg py-3 border-b">
                      <span className="text-slate-600">Additions</span>
                      <span className="font-bold">£{totals.additionsCost.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-lg py-3 border-b">
                    <span className="text-slate-600">Labour ({quoteData.labourDays} days)</span>
                    <span className="font-bold">£{totals.labourCost.toFixed(0)}</span>
                  </div>

                  <div className="flex justify-between text-lg py-3 border-b">
                    <span className="text-slate-600">Materials & First Fix</span>
                    <span className="font-bold">£{totals.materialsCost.toFixed(0)}</span>
                  </div>

                  <div className="flex justify-between text-lg py-3 border-b">
                    <span className="text-slate-600">Waste Removal</span>
                    <span className="font-bold">£{totals.removalCost.toFixed(0)}</span>
                  </div>

                  {totals.accessAdjustment > 0 && (
                    <div className="flex justify-between text-lg py-3 border-b">
                      <span className="text-slate-600">Access & Location</span>
                      <span className="font-bold text-amber-600">+£{totals.accessAdjustment.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-xl py-4 border-t-2 border-slate-300">
                    <span className="font-bold">Subtotal</span>
                    <span className="font-bold">£{totals.subtotal.toFixed(0)}</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-300">
                  <Label className="text-xl font-bold mb-3 block">Apply Discount</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={quoteData.discount}
                      onChange={e => setQuoteData({ ...quoteData, discount: parseFloat(e.target.value) || 0 })}
                      className="text-3xl p-6 border-2 rounded-2xl text-center font-bold"
                    />
                    <span className="text-4xl font-bold">%</span>
                  </div>
                  {quoteData.discount === 15 && (
                    <div className="mt-4 bg-amber-500 text-white p-4 rounded-xl">
                      <p className="font-bold text-lg">⚡ SAME-DAY DISCOUNT APPLIED!</p>
                      <p className="text-sm mt-1">Expires today at midnight - Save £{totals.discountAmount.toFixed(0)}</p>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-300">
                  <Label className="text-xl font-bold mb-3 block">Booking Deposit</Label>
                  <Input
                    type="number"
                    value={quoteData.bookingDeposit}
                    onChange={e => setQuoteData({ ...quoteData, bookingDeposit: parseFloat(e.target.value) })}
                    className="text-3xl p-6 border-2 rounded-2xl text-center font-bold"
                  />
                  <p className="text-center text-blue-700 mt-3">Secures your installation date</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border-2 border-purple-300">
                  <Label className="text-xl font-bold mb-3 block">Preferred Start Date</Label>
                  <Input
                    type="date"
                    value={quoteData.bookingDate}
                    onChange={e => setQuoteData({ ...quoteData, bookingDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="text-2xl p-6 border-2 rounded-2xl"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-4 mt-6 mb-24">
          {currentStage > 0 && (
            <Button
              onClick={() => setCurrentStage(currentStage - 1)}
              size="lg"
              className="flex-1 text-2xl py-8 rounded-2xl bg-slate-700 hover:bg-slate-800"
            >
              <ChevronLeft className="w-8 h-8 mr-2" />
              Previous
            </Button>
          )}
          {currentStage < stages.length - 1 ? (
            <Button
              onClick={() => setCurrentStage(currentStage + 1)}
              size="lg"
              className="flex-1 text-2xl py-8 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              Next
              <ChevronRight className="w-8 h-8 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              size="lg"
              className="flex-1 text-2xl py-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            >
              <Check className="w-8 h-8 mr-2" />
              Create Quote
            </Button>
          )}
        </div>

        {/* Price Preview (Always Visible) */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 shadow-2xl border-t-4 border-amber-500">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm opacity-75">Current Total</p>
              <p className="text-3xl font-bold">£{totals.total.toFixed(0)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-75">{quoteData.area.toFixed(1)}m² • {quoteData.labourDays} days</p>
              <p className="text-lg font-bold text-amber-400">{quoteData.customerName || 'No customer selected'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
