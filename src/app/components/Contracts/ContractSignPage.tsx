import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { FileSignature, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { signContractOnServer } from '../../engine/contracts/contractApi';
import type { ContractPublicView } from '../../engine/contracts/types';

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

export default function ContractSignPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractPublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signedByName, setSignedByName] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);

  const loadContract = useCallback(async () => {
    if (!token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/contract/${encodeURIComponent(token)}`);
      if (res.status === 410) {
        setError('This signing link has expired. Please contact us for a new link.');
        setContract(null);
        return;
      }
      if (!res.ok) {
        setError('Invalid or expired link');
        setContract(null);
        return;
      }
      const data = (await res.json()) as ContractPublicView;
      setContract(data);
      setError('');
      if (data.status === 'signed') {
        setSigned(true);
        setDepositAmount(data.depositAmount);
      }
    } catch {
      setError('Could not load contract');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const canSubmit =
    agreed &&
    signedByName.trim().length > 1 &&
    Boolean(signatureDataUrl) &&
    !submitting &&
    contract?.status === 'sent';

  const handleSign = async () => {
    if (!token || !canSubmit || !signatureDataUrl) return;
    setSubmitting(true);
    const result = await signContractOnServer(token, {
      signedByName: signedByName.trim(),
      signatureDataUrl,
      agreed: true,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Signing failed');
      return;
    }
    setSigned(true);
    setDepositAmount(result.depositAmount ?? contract?.depositAmount ?? 0);
    void loadContract();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Unable to open contract</h1>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed && contract) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-gray-50 p-6">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re booked in</h1>
              <p className="text-gray-600 mb-6">
                Thank you, {contract.customerName}. Your contract has been signed successfully.
              </p>
              {depositAmount > 0 && (
                <div className="bg-indigo-50 rounded-lg p-4 text-left">
                  <p className="font-medium text-indigo-900">Deposit due</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">{gbp(depositAmount)}</p>
                  <p className="text-sm text-indigo-800 mt-2">
                    Our team will be in touch with payment details shortly.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <FileSignature className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review &amp; sign your contract</h1>
            <p className="text-gray-600">{contract.customerName}{contract.tradeName ? ` — ${contract.tradeName}` : ''}</p>
          </div>
          <Badge className="ml-auto">{gbp(contract.total)}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contract terms</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
              {contract.bodyRendered}
            </pre>
          </CardContent>
        </Card>

        {contract.stages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">Stage</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2">When due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.stages.map((s, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{s.label}</td>
                        <td className="py-2 pr-4">{gbp(s.amount)} ({s.percent}%)</td>
                        <td className="py-2 text-gray-600">{s.dueTrigger}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md p-3">{error}</p>
            )}
            <div className="flex items-start gap-2">
              <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
              <Label htmlFor="agree" className="text-sm leading-snug cursor-pointer">
                I have read and agree to the terms of this contract
              </Label>
            </div>
            <div>
              <Label htmlFor="signer-name">Full name</Label>
              <Input
                id="signer-name"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder="As it appears on the contract"
                className="mt-1"
              />
            </div>
            <SignaturePad onChange={setSignatureDataUrl} />
            <Button
              className="w-full"
              size="lg"
              disabled={!canSubmit}
              onClick={() => void handleSign()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing…
                </>
              ) : (
                'Accept and sign'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
