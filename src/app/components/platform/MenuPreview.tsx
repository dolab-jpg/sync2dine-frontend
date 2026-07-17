import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, UtensilsCrossed, EyeOff } from 'lucide-react';
import {
  allergenBadgeLabels,
} from '../../engine/restaurant/allergens';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price?: number;
  basePrice?: number;
  description?: string;
  available?: boolean;
  allergensContains?: string[];
  allergensMayContain?: string[];
  dietary?: string[];
}

const CATEGORY_ORDER = ['starters', 'mains', 'sides', 'drinks', 'desserts', 'specials', 'other'];

export default function MenuPreview() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetch(`/api/products?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data.products ?? data) ? (data.products ?? data) : [];
        setItems(rows as MenuItem[]);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    fetch('/api/platform/organizations')
      .then((r) => r.json())
      .then((data) => {
        const orgs = Array.isArray(data) ? data : data.organizations ?? [];
        const org = orgs.find((o: { id: string }) => o.id === orgId);
        if (org?.name) setOrgName(org.name);
      })
      .catch(() => {});
  }, [orgId]);

  const foodItems = useMemo(
    () =>
      items
        .filter((p) => {
          const cat = (p.category || '').toLowerCase();
          return ['starters', 'mains', 'sides', 'drinks', 'desserts', 'specials'].includes(cat);
        })
        .sort((a, b) => {
          const ai = CATEGORY_ORDER.indexOf((a.category || '').toLowerCase());
          const bi = CATEGORY_ORDER.indexOf((b.category || '').toLowerCase());
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        }),
    [items],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of foodItems) {
      const cat = (item.category || 'other').toLowerCase();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [foodItems]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/platform/clients')}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to clients
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {orgName ? `${orgName} — Menu` : 'Menu Preview'}
            </h1>
            <p className="text-sm text-slate-500">Read-only view of this client's food menu</p>
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-slate-500">Loading menu…</p>
        ) : foodItems.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="py-12 text-center">
              <UtensilsCrossed className="mx-auto mb-3 h-14 w-14 text-slate-300" />
              <p className="font-medium text-slate-600">No menu items found for this client</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {[...byCategory.entries()].map(([category, catItems]) => (
              <Card key={category} className="rounded-2xl shadow-lg border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg capitalize">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {catItems.map((item) => {
                    const price = item.price ?? item.basePrice ?? 0;
                    const allergenInfo = allergenBadgeLabels(item as Record<string, unknown>);
                    const badges = allergenInfo.labels;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start justify-between gap-3 rounded-xl p-3 ${
                          item.available === false ? 'bg-slate-100 opacity-60' : 'bg-white border border-slate-100'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{item.name}</p>
                            {item.available === false && (
                              <Badge variant="secondary" className="text-xs">
                                <EyeOff className="mr-1 h-3 w-3" />
                                Unavailable
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>
                          )}
                          {badges.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {badges.map((b) => (
                                <span
                                  key={b}
                                  className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="shrink-0 text-lg font-black text-slate-900">
                          £{price.toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
