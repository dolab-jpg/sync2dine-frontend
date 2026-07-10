import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AppContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Download, Upload, Database, FileSpreadsheet, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  exportCustomersCsv,
  exportEstimationPackJson,
  exportFullBackupJson,
  getExportCounts,
  parseImportFile,
  validateBundle,
  type MergeStrategy,
  type TradeProExportBundle,
} from '../../engine/data/dataImportExportService';

function formatSummary(summary: Record<string, number | undefined>): string {
  const parts = Object.entries(summary)
    .filter(([, count]) => count !== undefined && count > 0)
    .map(([key, count]) => `${count} ${key}`);
  return parts.length > 0 ? parts.join(', ') : 'No records';
}

export default function ImportExportPanel() {
  const context = useContext(AppContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [pendingBundle, setPendingBundle] = useState<TradeProExportBundle | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<MergeStrategy>('skip');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [importing, setImporting] = useState(false);

  if (!context) return null;

  const { customers, quotes, products, pricingRules, importDataBundle } = context;
  const exportContext = { customers, quotes, products, pricingRules };
  const counts = useMemo(() => getExportCounts(exportContext), [customers, quotes, products, pricingRules]);

  const validation = useMemo(() => {
    if (!pendingBundle) return null;
    return validateBundle(pendingBundle);
  }, [pendingBundle]);

  const handleFile = useCallback(async (file: File) => {
    try {
      const parsed = await parseImportFile(file);
      setPendingBundle(parsed.bundle);
      setCsvErrors(parsed.csvErrors ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read file.');
      setPendingBundle(null);
      setCsvErrors([]);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const onApplyImport = () => {
    if (!pendingBundle || !validation?.valid) return;

    if (strategy === 'replace' && !confirmChecked) {
      setConfirmOpen(true);
      return;
    }

    setImporting(true);
    const result = importDataBundle(pendingBundle, { strategy });
    setImporting(false);
    setConfirmOpen(false);
    setConfirmChecked(false);
    setPendingBundle(null);
    setCsvErrors([]);

    if (result.errors.length > 0) {
      toast.error(result.errors.join(' '));
      return;
    }

    toast.success(
      `Import complete: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`
    );
  };

  const totalIncoming = validation ? Object.values(validation.summary).reduce((a, b) => a + (b ?? 0), 0) : 0;

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Exports may contain personal customer data. Store backup files securely and only import
            files from trusted sources.
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Export</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-slate-600" />
                <CardTitle className="text-base">Full Business Backup</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                All customers, quotes, products, pricing rules, projects, contacts, banking, and
                planning data as JSON.
              </p>
              <p className="text-xs text-gray-500">{formatSummary(counts.full as Record<string, number>)}</p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => exportFullBackupJson(exportContext)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download JSON
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-600" />
                <CardTitle className="text-base">Estimation Pack</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Customers, quotes (including site details), products, pricing rules, and surveys.
              </p>
              <p className="text-xs text-gray-500">
                {formatSummary(counts.estimation as Record<string, number>)}
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => exportEstimationPackJson(exportContext)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download JSON
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-slate-600" />
                <CardTitle className="text-base">Customer Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Flat CSV for spreadsheet editing — name, email, phone, address, status, and more.
              </p>
              <p className="text-xs text-gray-500">{counts.customers} customers</p>
              <Button className="w-full" variant="outline" onClick={() => exportCustomersCsv(customers)}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Import</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div
              className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-3" />
              <p className="text-sm text-gray-700 mb-2">
                Drag and drop a JSON backup or customer CSV file here
              </p>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,application/json,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {pendingBundle && validation && (
              <div className="rounded-lg border bg-white p-4 space-y-4">
                <div>
                  <p className="font-medium text-gray-900">Preview</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Scope: <span className="font-mono">{validation.scope}</span>
                    {' · '}
                    {formatSummary(validation.summary as Record<string, number>)}
                  </p>
                </div>

                {validation.errors.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <ul className="list-disc pl-5 space-y-1">
                      {validation.errors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {csvErrors.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium mb-1">CSV row warnings ({csvErrors.length})</p>
                    <ul className="list-disc pl-5 space-y-1 max-h-32 overflow-y-auto">
                      {csvErrors.slice(0, 10).map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                      {csvErrors.length > 10 && <li>…and {csvErrors.length - 10} more</li>}
                    </ul>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Merge strategy</Label>
                    <Select value={strategy} onValueChange={(v: MergeStrategy) => setStrategy(v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip duplicates (keep existing)</SelectItem>
                        <SelectItem value="upsert">Merge upsert (update by ID)</SelectItem>
                        <SelectItem value="replace">Replace all in scope</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => {
                      if (strategy === 'replace') {
                        setConfirmOpen(true);
                      } else {
                        onApplyImport();
                      }
                    }}
                    disabled={!validation.valid || importing || totalIncoming === 0}
                  >
                    Apply import
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPendingBundle(null);
                      setCsvErrors([]);
                      setConfirmChecked(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm replace import</DialogTitle>
            <DialogDescription>
              Replace will overwrite entire datasets for each entity type in this file (
              {totalIncoming} records). Existing records not in the file will be removed for those
              entity types.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="confirm-replace"
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(checked === true)}
            />
            <Label htmlFor="confirm-replace" className="text-sm font-normal">
              I understand this will replace data in scope
            </Label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmChecked || importing}
              onClick={onApplyImport}
            >
              Replace and import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
