import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ClipboardCheck, Camera, AlertTriangle, CheckCircle, XCircle, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getAllTrades, getTrade } from '../config/trades';
import type { TradeId } from '../config/types';
import { scoreSurvey, saveSurvey } from '../engine/surveyScorer';
import { useResolvedTrade } from '../hooks/useResolvedTrade';
import { useAIAssistant } from '../context/AIAssistantContext';

interface SurveyData {
  customerId: string;

  // Measurements
  length: string;
  width: string;
  height: string;
  area: string;

  // Floor Condition
  floorLevel: 'yes' | 'slightly_uneven' | 'very_uneven' | '';
  floorType: 'concrete' | 'timber' | '';
  floorMovement: 'no' | 'slight' | 'yes' | '';
  rotDamage: 'no' | 'unsure' | 'yes' | '';

  // Water Damage
  previousLeak: 'no' | 'fixed' | 'ongoing' | '';
  dampMould: 'no' | 'minor' | 'severe' | '';
  wallsSoft: 'no' | 'yes' | '';

  // Wall Condition
  wallType: 'solid' | 'stud' | '';
  wallsStraight: 'yes' | 'slightly' | 'very_uneven' | '';
  looseTiles: 'no' | 'yes' | '';

  // Plumbing
  fixturesMoving: 'yes' | 'no' | '';
  waterPressure: 'good' | 'average' | 'poor' | '';
  pipeCondition: 'modern' | 'old_working' | 'needs_replacing' | '';
  systemType: 'combi' | 'gravity' | '';

  // Electrical
  lighting: 'modern' | 'old' | '';
  extractorFan: 'yes' | 'no' | '';
  consumerUnit: 'adequate' | 'unknown' | 'needs_upgrade' | '';

  // Substrate
  behindFinish: 'solid' | 'plasterboard' | 'unknown' | '';
  waterproofing: 'yes' | 'no' | 'unknown' | '';

  // Access
  floorLocation: 'ground' | 'upstairs' | 'loft' | '';
  parking: 'easy' | 'limited' | 'difficult' | '';
  wasteRemoval: 'easy' | 'difficult' | '';

  // Photos
  photos: string[];

  // Notes
  additionalNotes: string;
}

export default function SiteSurvey() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  if (!context) return null;

  const { customers } = context;
  const { tradeId: resolvedTradeId, setTradeOverride } = useResolvedTrade();
  const { setIsOpen } = useAIAssistant();
  const [tradeId, setTradeId] = useState<TradeId | null>(null);
  const [showManualTradePicker, setShowManualTradePicker] = useState(false);

  useEffect(() => {
    if (resolvedTradeId && !tradeId) {
      setTradeId(resolvedTradeId);
    }
  }, [resolvedTradeId, tradeId]);
  const [currentSection, setCurrentSection] = useState(0);
  const [surveyData, setSurveyData] = useState<SurveyData>({
    customerId: '',
    length: '',
    width: '',
    height: '',
    area: '',
    floorLevel: '',
    floorType: '',
    floorMovement: '',
    rotDamage: '',
    previousLeak: '',
    dampMould: '',
    wallsSoft: '',
    wallType: '',
    wallsStraight: '',
    looseTiles: '',
    fixturesMoving: '',
    waterPressure: '',
    pipeCondition: '',
    systemType: '',
    lighting: '',
    extractorFan: '',
    consumerUnit: '',
    behindFinish: '',
    waterproofing: '',
    floorLocation: '',
    parking: '',
    wasteRemoval: '',
    photos: [],
    additionalNotes: ''
  });

  const updateMeasurements = (field: string, value: string) => {
    const updated = { ...surveyData, [field]: value };
    if (updated.length && updated.width) {
      const area = (parseFloat(updated.length) * parseFloat(updated.width)).toFixed(2);
      updated.area = area;
    }
    setSurveyData(updated);
  };

  const calculateRiskScore = (): { score: number; level: 'low' | 'medium' | 'high'; adjustments: { reason: string; cost: number }[] } => {
    let score = 0;
    const adjustments: { reason: string; cost: number }[] = [];

    if (surveyData.floorLevel === 'slightly_uneven') {
      score += 2;
      adjustments.push({ reason: 'Slightly uneven floor - self-levelling required', cost: 250 });
    }
    if (surveyData.floorLevel === 'very_uneven') {
      score += 5;
      adjustments.push({ reason: 'Very uneven floor - rebuild/boarding required', cost: 600 });
    }
    if (surveyData.floorMovement === 'slight') {
      score += 3;
      adjustments.push({ reason: 'Floor movement - reinforcement needed', cost: 400 });
    }
    if (surveyData.floorMovement === 'yes') {
      score += 6;
      adjustments.push({ reason: 'Significant floor movement - joist strengthening', cost: 800 });
    }
    if (surveyData.rotDamage === 'yes') {
      score += 8;
      adjustments.push({ reason: 'Rot/damage to joists - structural repair', cost: 1200 });
    }
    if (surveyData.previousLeak === 'ongoing') {
      score += 7;
      adjustments.push({ reason: 'Ongoing leak - repair required before work', cost: 500 });
    }
    if (surveyData.dampMould === 'severe') {
      score += 6;
      adjustments.push({ reason: 'Severe damp/mould - tanking and treatment', cost: 800 });
    }
    if (surveyData.wallsSoft === 'yes') {
      score += 5;
      adjustments.push({ reason: 'Soft walls - rebuild required', cost: 700 });
    }
    if (surveyData.wallsStraight === 'very_uneven') {
      score += 4;
      adjustments.push({ reason: 'Very uneven walls - boarding/plastering', cost: 500 });
    }
    if (surveyData.looseTiles === 'yes') {
      score += 2;
      adjustments.push({ reason: 'Loose tiles - extra prep time', cost: 200 });
    }
    if (surveyData.fixturesMoving === 'no') {
      score += 4;
      adjustments.push({ reason: 'Moving plumbing fixtures', cost: 800 });
    }
    if (surveyData.pipeCondition === 'needs_replacing') {
      score += 5;
      adjustments.push({ reason: 'Old pipes - full replacement needed', cost: 900 });
    }
    if (surveyData.waterPressure === 'poor') {
      score += 3;
      adjustments.push({ reason: 'Poor water pressure - pump may be needed', cost: 400 });
    }
    if (surveyData.extractorFan === 'no') {
      score += 1;
      adjustments.push({ reason: 'No extractor fan - installation required', cost: 180 });
    }
    if (surveyData.consumerUnit === 'needs_upgrade') {
      score += 4;
      adjustments.push({ reason: 'Consumer unit upgrade needed', cost: 600 });
    }
    if (surveyData.waterproofing === 'no') {
      score += 3;
      adjustments.push({ reason: 'No waterproofing - tanking system required', cost: 450 });
    }
    if (surveyData.parking === 'difficult') {
      score += 1;
      adjustments.push({ reason: 'Difficult parking - increased labour time', cost: 150 });
    }
    if (surveyData.wasteRemoval === 'difficult') {
      score += 1;
      adjustments.push({ reason: 'Difficult waste removal', cost: 100 });
    }

    const level = score <= 5 ? 'low' : score <= 15 ? 'medium' : 'high';
    return { score, level, adjustments };
  };

  const risk = calculateRiskScore();
  const totalAdjustment = risk.adjustments.reduce((sum, adj) => sum + adj.cost, 0);

  const sections = [
    { title: 'Customer & Measurements', icon: ClipboardCheck },
    { title: 'Floor Condition', icon: AlertTriangle },
    { title: 'Water Damage', icon: AlertTriangle },
    { title: 'Walls', icon: AlertTriangle },
    { title: 'Plumbing', icon: AlertTriangle },
    { title: 'Electrical', icon: AlertTriangle },
    { title: 'Substrate & Access', icon: AlertTriangle },
    { title: 'Photos & Notes', icon: Camera },
    { title: 'Risk Assessment', icon: CheckCircle }
  ];

  const OptionButton = ({
    selected,
    onClick,
    children,
    variant = 'default'
  }: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    variant?: 'success' | 'warning' | 'danger' | 'default';
  }) => {
    const colors = {
      success: 'border-green-500 bg-green-50 text-green-700',
      warning: 'border-yellow-500 bg-yellow-50 text-yellow-700',
      danger: 'border-red-500 bg-red-50 text-red-700',
      default: 'border-blue-500 bg-blue-50 text-blue-700'
    };

    return (
      <button
        onClick={onClick}
        className={`p-4 rounded-lg border-2 transition-all text-left flex-1 min-h-[70px] ${
          selected ? colors[variant] : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        {children}
      </button>
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPhotos: string[] = [];
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          newPhotos.push(event.target?.result as string);
          if (newPhotos.length === files.length) {
            setSurveyData({ ...surveyData, photos: [...surveyData.photos, ...newPhotos] });
            toast.success(`${files.length} photo(s) added`);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleComplete = () => {
    if (!tradeId) {
      toast.error('Describe the job in AI or pick a trade first');
      return;
    }
    const trade = getTrade(tradeId);
    const { riskScore, suggestedAdjustments } = scoreSurvey(trade, surveyData as unknown as Record<string, unknown>);
    saveSurvey({
      customerId: surveyData.customerId,
      tradeId,
      answers: surveyData as unknown as Record<string, unknown>,
      riskScore,
      suggestedAdjustments,
    });
    toast.success('Site survey saved! Creating quote...');
    setTimeout(() => {
      navigate(`/quote/${tradeId}/${surveyData.customerId}`);
    }, 800);
  };

  if (!tradeId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-4">
            <Sparkles className="w-12 h-12 mx-auto text-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900">Site Survey</h1>
            <p className="text-gray-600">
              Open the AI assistant and describe the job — it will detect the trade for this survey.
            </p>
            <Button className="w-full" onClick={() => setIsOpen(true)} title="Describe the job and AI detects the trade for this survey">
              AI
            </Button>
            {!showManualTradePicker ? (
              <Button variant="ghost" className="w-full" onClick={() => setShowManualTradePicker(true)}>
                Or pick trade manually
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {getAllTrades().map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTradeId(t.id);
                      setTradeOverride(t.id);
                    }}
                    className="px-3 py-1.5 rounded-full text-sm font-medium border bg-white text-slate-700 border-slate-200 hover:border-amber-300"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Site Survey</h1>
            <p className="text-gray-600 mt-1">Trade-aware site survey — {getTrade(tradeId).name}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowManualTradePicker(!showManualTradePicker)}>
            Change trade
          </Button>
        </div>

        {showManualTradePicker && (
          <div className="mb-4 flex flex-wrap gap-2">
            {getAllTrades().map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTradeId(t.id);
                  setTradeOverride(t.id);
                  setShowManualTradePicker(false);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                  tradeId === t.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Progress */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Section {currentSection + 1} of {sections.length}</span>
            <span className="text-sm text-gray-600">{sections[currentSection].title}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: `${((currentSection + 1) / sections.length) * 100}%` }}
            />
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              {React.createElement(sections[currentSection].icon, { className: 'w-6 h-6' })}
              {sections[currentSection].title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentSection === 0 && (
              <>
                <div>
                  <Label className="text-lg mb-3 block">Select Customer</Label>
                  <Select value={surveyData.customerId} onValueChange={(value) => setSurveyData({ ...surveyData, customerId: value })}>
                    <SelectTrigger className="text-lg p-6">
                      <SelectValue placeholder="Choose customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id} className="text-lg py-4">
                          {customer.name} - {customer.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-6">
                  <Label className="text-lg mb-3 block">Room Measurements</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Length (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={surveyData.length}
                        onChange={e => updateMeasurements('length', e.target.value)}
                        className="text-xl p-6"
                        placeholder="3.5"
                      />
                    </div>
                    <div>
                      <Label>Width (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={surveyData.width}
                        onChange={e => updateMeasurements('width', e.target.value)}
                        className="text-xl p-6"
                        placeholder="2.5"
                      />
                    </div>
                    <div>
                      <Label>Height (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={surveyData.height}
                        onChange={e => setSurveyData({ ...surveyData, height: e.target.value })}
                        className="text-xl p-6"
                        placeholder="2.4"
                      />
                    </div>
                    <div>
                      <Label>Area (m²)</Label>
                      <Input
                        value={surveyData.area}
                        readOnly
                        className="text-xl p-6 bg-gray-100 font-bold"
                        placeholder="Auto"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentSection === 1 && (
              <>
                <div>
                  <Label className="text-lg mb-3 block">Is the floor level?</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <OptionButton
                      selected={surveyData.floorLevel === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, floorLevel: 'yes' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">✅ Yes - Level</div>
                      <div className="text-sm mt-1">No additional work needed</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.floorLevel === 'slightly_uneven'}
                      onClick={() => setSurveyData({ ...surveyData, floorLevel: 'slightly_uneven' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">⚠️ Slightly Uneven</div>
                      <div className="text-sm mt-1">+£150-£300 (self-levelling)</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.floorLevel === 'very_uneven'}
                      onClick={() => setSurveyData({ ...surveyData, floorLevel: 'very_uneven' })}
                      variant="danger"
                    >
                      <div className="font-medium text-lg">❌ Very Uneven</div>
                      <div className="text-sm mt-1">+£400-£800 (rebuild/boarding)</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Floor type?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.floorType === 'concrete'}
                      onClick={() => setSurveyData({ ...surveyData, floorType: 'concrete' })}
                    >
                      <div className="font-medium text-lg">Concrete</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.floorType === 'timber'}
                      onClick={() => setSurveyData({ ...surveyData, floorType: 'timber' })}
                    >
                      <div className="font-medium text-lg">Timber Joists</div>
                      <div className="text-sm mt-1">May need reinforcement</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Floor movement or bounce?</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <OptionButton
                      selected={surveyData.floorMovement === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, floorMovement: 'no' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">No movement</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.floorMovement === 'slight'}
                      onClick={() => setSurveyData({ ...surveyData, floorMovement: 'slight' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Slight movement</div>
                      <div className="text-sm mt-1">+£400 reinforcement</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.floorMovement === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, floorMovement: 'yes' })}
                      variant="danger"
                    >
                      <div className="font-medium text-lg">Noticeable movement</div>
                      <div className="text-sm mt-1">+£800 joist strengthening</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Signs of rot or damaged joists?</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <OptionButton
                      selected={surveyData.rotDamage === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, rotDamage: 'no' })}
                      variant="success"
                    >
                      <div className="font-medium">No</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.rotDamage === 'unsure'}
                      onClick={() => setSurveyData({ ...surveyData, rotDamage: 'unsure' })}
                      variant="warning"
                    >
                      <div className="font-medium">Unsure</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.rotDamage === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, rotDamage: 'yes' })}
                      variant="danger"
                    >
                      <div className="font-medium">Yes</div>
                      <div className="text-xs mt-1">+£500-£2000</div>
                    </OptionButton>
                  </div>
                </div>
              </>
            )}

            {currentSection === 2 && (
              <>
                <div>
                  <Label className="text-lg mb-3 block">Previous leak history?</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <OptionButton
                      selected={surveyData.previousLeak === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, previousLeak: 'no' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">No previous leaks</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.previousLeak === 'fixed'}
                      onClick={() => setSurveyData({ ...surveyData, previousLeak: 'fixed' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Yes (Fixed)</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.previousLeak === 'ongoing'}
                      onClick={() => setSurveyData({ ...surveyData, previousLeak: 'ongoing' })}
                      variant="danger"
                    >
                      <div className="font-medium text-lg">Ongoing/Unsure</div>
                      <div className="text-sm mt-1">Must fix before work begins</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Visible damp, mould, or staining?</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <OptionButton
                      selected={surveyData.dampMould === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, dampMould: 'no' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">No signs</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.dampMould === 'minor'}
                      onClick={() => setSurveyData({ ...surveyData, dampMould: 'minor' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Minor</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.dampMould === 'severe'}
                      onClick={() => setSurveyData({ ...surveyData, dampMould: 'severe' })}
                      variant="danger"
                    >
                      <div className="font-medium text-lg">Severe</div>
                      <div className="text-sm mt-1">+£800 tanking & treatment</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Walls soft or crumbling?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.wallsSoft === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, wallsSoft: 'no' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">No</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.wallsSoft === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, wallsSoft: 'yes' })}
                      variant="danger"
                    >
                      <div className="font-medium text-lg">Yes</div>
                      <div className="text-sm mt-1">+£700 wall rebuild</div>
                    </OptionButton>
                  </div>
                </div>
              </>
            )}

            {currentSection === 3 && (
              <>
                <div>
                  <Label className="text-lg mb-3 block">Wall type?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.wallType === 'solid'}
                      onClick={() => setSurveyData({ ...surveyData, wallType: 'solid' })}
                    >
                      <div className="font-medium text-lg">Solid (Brick/Block)</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.wallType === 'stud'}
                      onClick={() => setSurveyData({ ...surveyData, wallType: 'stud' })}
                    >
                      <div className="font-medium text-lg">Stud Wall</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Walls straight and plumb?</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <OptionButton
                      selected={surveyData.wallsStraight === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, wallsStraight: 'yes' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">Yes</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.wallsStraight === 'slightly'}
                      onClick={() => setSurveyData({ ...surveyData, wallsStraight: 'slightly' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Slightly uneven</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.wallsStraight === 'very_uneven'}
                      onClick={() => setSurveyData({ ...surveyData, wallsStraight: 'very_uneven' })}
                      variant="danger"
                    >
                      <div className="font-medium text-lg">Very uneven</div>
                      <div className="text-sm mt-1">+£500 boarding/plastering</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Loose tiles or hollow areas?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.looseTiles === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, looseTiles: 'no' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">No</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.looseTiles === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, looseTiles: 'yes' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Yes</div>
                      <div className="text-sm mt-1">+£200 extra prep</div>
                    </OptionButton>
                  </div>
                </div>
              </>
            )}

            {currentSection === 4 && (
              <>
                <div>
                  <Label className="text-lg mb-3 block">Fixtures staying in same position?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.fixturesMoving === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, fixturesMoving: 'yes' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">Yes (same position)</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.fixturesMoving === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, fixturesMoving: 'no' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">No (moving)</div>
                      <div className="text-sm mt-1">+£300-£1500 waste relocation</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Water pressure?</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <OptionButton
                      selected={surveyData.waterPressure === 'good'}
                      onClick={() => setSurveyData({ ...surveyData, waterPressure: 'good' })}
                      variant="success"
                    >
                      <div className="font-medium">Good</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.waterPressure === 'average'}
                      onClick={() => setSurveyData({ ...surveyData, waterPressure: 'average' })}
                    >
                      <div className="font-medium">Average</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.waterPressure === 'poor'}
                      onClick={() => setSurveyData({ ...surveyData, waterPressure: 'poor' })}
                      variant="warning"
                    >
                      <div className="font-medium">Poor</div>
                      <div className="text-xs mt-1">May need pump</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Pipe condition?</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <OptionButton
                      selected={surveyData.pipeCondition === 'modern'}
                      onClick={() => setSurveyData({ ...surveyData, pipeCondition: 'modern' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">Modern</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.pipeCondition === 'old_working'}
                      onClick={() => setSurveyData({ ...surveyData, pipeCondition: 'old_working' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Old but working</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.pipeCondition === 'needs_replacing'}
                      onClick={() => setSurveyData({ ...surveyData, pipeCondition: 'needs_replacing' })}
                      variant="danger"
                    >
                      <div className="font-medium text-lg">Very old / needs replacing</div>
                      <div className="text-sm mt-1">+£900 full replacement</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">System type?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.systemType === 'combi'}
                      onClick={() => setSurveyData({ ...surveyData, systemType: 'combi' })}
                    >
                      <div className="font-medium text-lg">Combi Boiler</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.systemType === 'gravity'}
                      onClick={() => setSurveyData({ ...surveyData, systemType: 'gravity' })}
                    >
                      <div className="font-medium text-lg">Gravity/Tank</div>
                    </OptionButton>
                  </div>
                </div>
              </>
            )}

            {currentSection === 5 && (
              <>
                <div>
                  <Label className="text-lg mb-3 block">Lighting condition?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.lighting === 'modern'}
                      onClick={() => setSurveyData({ ...surveyData, lighting: 'modern' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">Modern</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.lighting === 'old'}
                      onClick={() => setSurveyData({ ...surveyData, lighting: 'old' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Old</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Extractor fan present?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.extractorFan === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, extractorFan: 'yes' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">Yes</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.extractorFan === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, extractorFan: 'no' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">No</div>
                      <div className="text-sm mt-1">+£180 installation</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Consumer unit capacity?</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <OptionButton
                      selected={surveyData.consumerUnit === 'adequate'}
                      onClick={() => setSurveyData({ ...surveyData, consumerUnit: 'adequate' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">Adequate</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.consumerUnit === 'unknown'}
                      onClick={() => setSurveyData({ ...surveyData, consumerUnit: 'unknown' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Unknown</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.consumerUnit === 'needs_upgrade'}
                      onClick={() => setSurveyData({ ...surveyData, consumerUnit: 'needs_upgrade' })}
                      variant="danger"
                    >
                      <div className="font-medium text-lg">Needs upgrade</div>
                      <div className="text-sm mt-1">+£600 upgrade</div>
                    </OptionButton>
                  </div>
                </div>
              </>
            )}

            {currentSection === 6 && (
              <>
                <div>
                  <Label className="text-lg mb-3 block">What's behind the finish?</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <OptionButton
                      selected={surveyData.behindFinish === 'solid'}
                      onClick={() => setSurveyData({ ...surveyData, behindFinish: 'solid' })}
                    >
                      <div className="font-medium">Solid Wall</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.behindFinish === 'plasterboard'}
                      onClick={() => setSurveyData({ ...surveyData, behindFinish: 'plasterboard' })}
                    >
                      <div className="font-medium">Plasterboard</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.behindFinish === 'unknown'}
                      onClick={() => setSurveyData({ ...surveyData, behindFinish: 'unknown' })}
                      variant="warning"
                    >
                      <div className="font-medium">Unknown</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Waterproofing currently installed?</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <OptionButton
                      selected={surveyData.waterproofing === 'yes'}
                      onClick={() => setSurveyData({ ...surveyData, waterproofing: 'yes' })}
                      variant="success"
                    >
                      <div className="font-medium">Yes</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.waterproofing === 'no'}
                      onClick={() => setSurveyData({ ...surveyData, waterproofing: 'no' })}
                      variant="warning"
                    >
                      <div className="font-medium">No</div>
                      <div className="text-xs mt-1">+£450 tanking</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.waterproofing === 'unknown'}
                      onClick={() => setSurveyData({ ...surveyData, waterproofing: 'unknown' })}
                      variant="warning"
                    >
                      <div className="font-medium">Unknown</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Floor location?</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <OptionButton
                      selected={surveyData.floorLocation === 'ground'}
                      onClick={() => setSurveyData({ ...surveyData, floorLocation: 'ground' })}
                    >
                      <div className="font-medium">Ground</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.floorLocation === 'upstairs'}
                      onClick={() => setSurveyData({ ...surveyData, floorLocation: 'upstairs' })}
                    >
                      <div className="font-medium">Upstairs</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.floorLocation === 'loft'}
                      onClick={() => setSurveyData({ ...surveyData, floorLocation: 'loft' })}
                      variant="warning"
                    >
                      <div className="font-medium">Loft</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Parking?</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <OptionButton
                      selected={surveyData.parking === 'easy'}
                      onClick={() => setSurveyData({ ...surveyData, parking: 'easy' })}
                      variant="success"
                    >
                      <div className="font-medium">Easy</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.parking === 'limited'}
                      onClick={() => setSurveyData({ ...surveyData, parking: 'limited' })}
                    >
                      <div className="font-medium">Limited</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.parking === 'difficult'}
                      onClick={() => setSurveyData({ ...surveyData, parking: 'difficult' })}
                      variant="warning"
                    >
                      <div className="font-medium">Difficult</div>
                      <div className="text-xs mt-1">+£150</div>
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <Label className="text-lg mb-3 block">Waste removal?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionButton
                      selected={surveyData.wasteRemoval === 'easy'}
                      onClick={() => setSurveyData({ ...surveyData, wasteRemoval: 'easy' })}
                      variant="success"
                    >
                      <div className="font-medium text-lg">Easy</div>
                    </OptionButton>
                    <OptionButton
                      selected={surveyData.wasteRemoval === 'difficult'}
                      onClick={() => setSurveyData({ ...surveyData, wasteRemoval: 'difficult' })}
                      variant="warning"
                    >
                      <div className="font-medium text-lg">Difficult</div>
                      <div className="text-sm mt-1">+£100</div>
                    </OptionButton>
                  </div>
                </div>
              </>
            )}

            {currentSection === 7 && (
              <>
                <div>
                  <Label className="text-lg mb-3 block">Upload Photos</Label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    <Camera className="w-12 h-12 text-gray-400 mb-3" />
                    <p className="text-lg font-medium">Tap to take/upload photos</p>
                    <p className="text-sm text-gray-500 mt-1">Current bathroom condition</p>
                  </label>
                </div>

                {surveyData.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {surveyData.photos.map((photo, i) => (
                      <img key={i} src={photo} alt={`Photo ${i + 1}`} className="w-full h-24 object-cover rounded" />
                    ))}
                  </div>
                )}

                <div>
                  <Label htmlFor="notes" className="text-lg mb-3 block">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={surveyData.additionalNotes}
                    onChange={e => setSurveyData({ ...surveyData, additionalNotes: e.target.value })}
                    rows={4}
                    className="text-lg p-4"
                    placeholder="Any special considerations, customer requests, or site-specific issues..."
                  />
                </div>
              </>
            )}

            {currentSection === 8 && (
              <>
                <div className={`p-6 rounded-lg border-2 ${
                  risk.level === 'low' ? 'bg-green-50 border-green-500' :
                  risk.level === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-red-50 border-red-500'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">Risk Level: {risk.level.toUpperCase()}</h3>
                      <p className="text-sm mt-1">Risk Score: {risk.score}</p>
                    </div>
                    {risk.level === 'low' && <CheckCircle className="w-12 h-12 text-green-600" />}
                    {risk.level === 'medium' && <AlertTriangle className="w-12 h-12 text-yellow-600" />}
                    {risk.level === 'high' && <XCircle className="w-12 h-12 text-red-600" />}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-lg mb-3">Required Adjustments</h4>
                  {risk.adjustments.length === 0 ? (
                    <p className="text-gray-600">No additional work required</p>
                  ) : (
                    <div className="space-y-2">
                      {risk.adjustments.map((adj, i) => (
                        <div key={i} className="flex justify-between p-3 bg-gray-50 rounded">
                          <span>{adj.reason}</span>
                          <span className="font-bold text-red-600">+£{adj.cost}</span>
                        </div>
                      ))}
                      <div className="flex justify-between p-4 bg-blue-50 rounded-lg border-2 border-blue-500">
                        <span className="font-bold text-lg">Total Adjustment</span>
                        <span className="font-bold text-xl text-blue-700">+£{totalAdjustment}</span>
                      </div>
                    </div>
                  )}
                </div>

                {risk.level === 'high' && (
                  <div className="bg-red-50 border-2 border-red-500 p-4 rounded-lg">
                    <p className="font-medium text-red-900">⚠️ High Risk Project</p>
                    <p className="text-sm text-red-700 mt-1">Consider adding 10-15% contingency</p>
                  </div>
                )}

                <div className="bg-gray-100 p-4 rounded-lg text-sm text-gray-700">
                  <p className="font-medium mb-2">Contract Terms to Include:</p>
                  <ul className="space-y-1">
                    <li>• Subject to site inspection during strip-out</li>
                    <li>• Hidden defects not included in quote</li>
                    <li>• Additional works charged separately</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          {currentSection > 0 && (
            <Button
              onClick={() => setCurrentSection(currentSection - 1)}
              variant="outline"
              size="lg"
              className="flex-1 text-lg py-6"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>
          )}
          {currentSection < sections.length - 1 ? (
            <Button
              onClick={() => setCurrentSection(currentSection + 1)}
              size="lg"
              className="flex-1 text-lg py-6"
            >
              Next
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              size="lg"
              className="flex-1 text-lg py-6 bg-green-600 hover:bg-green-700"
              disabled={!surveyData.customerId}
            >
              Complete Survey & Create Quote
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
