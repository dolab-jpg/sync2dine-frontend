import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function FinanceApplication() {
  const [step, setStep] = useState(1);
  const [loanAmount, setLoanAmount] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    employmentStatus: '',
    annualIncome: '',
    monthlyExpenses: '',
    term: '36',
    loanAmount: ''
  });

  const interestRate = 9.9;

  const calculateMonthly = (amount: number, months: number) => {
    const monthlyRate = interestRate / 100 / 12;
    const payment = (amount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    return payment;
  };

  const handleLoanAmountChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    const months = parseInt(formData.term);
    setLoanAmount(value);
    setFormData({ ...formData, loanAmount: value });
    setMonthlyPayment(calculateMonthly(amount, months));
  };

  const handleTermChange = (value: string) => {
    const amount = parseFloat(loanAmount) || 0;
    const months = parseInt(value);
    setFormData({ ...formData, term: value });
    setMonthlyPayment(calculateMonthly(amount, months));
  };

  const handleSubmit = () => {
    toast.success('Finance application submitted! Awaiting approval...');
    setTimeout(() => {
      toast.success('Finance application approved! £' + loanAmount + ' available.');
      setStep(3);
    }, 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Finance Application</h1>
        <p className="text-gray-600 mt-1">Help your customers spread the cost with flexible payment plans</p>
      </div>

      {step === 1 && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Finance Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="loanAmount" className="text-lg">Project Cost</Label>
                <Input
                  id="loanAmount"
                  type="number"
                  value={loanAmount}
                  onChange={e => handleLoanAmountChange(e.target.value)}
                  placeholder="8000"
                  className="text-2xl p-6 mt-2"
                />
                <p className="text-sm text-gray-500 mt-1">Enter the total cost of the bathroom project</p>
              </div>

              <div>
                <Label htmlFor="term" className="text-lg">Repayment Period</Label>
                <Select value={formData.term} onValueChange={handleTermChange}>
                  <SelectTrigger className="text-lg p-6 mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12" className="text-lg py-3">12 months</SelectItem>
                    <SelectItem value="24" className="text-lg py-3">24 months</SelectItem>
                    <SelectItem value="36" className="text-lg py-3">36 months</SelectItem>
                    <SelectItem value="48" className="text-lg py-3">48 months</SelectItem>
                    <SelectItem value="60" className="text-lg py-3">60 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {monthlyPayment > 0 && (
                <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-500">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Estimated Monthly Payment</p>
                    <p className="text-4xl font-bold text-blue-700">£{monthlyPayment.toFixed(2)}</p>
                    <p className="text-sm text-gray-600 mt-3">
                      APR: {interestRate}% • Total repayable: £{(monthlyPayment * parseInt(formData.term)).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Finance Options Available:</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>✓ 0% deposit options available</li>
                  <li>✓ No early repayment fees</li>
                  <li>✓ Flexible terms from 12-60 months</li>
                  <li>✓ Instant decision in most cases</li>
                  <li>✓ Won't affect current credit rating for quote</li>
                </ul>
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!loanAmount || parseFloat(loanAmount) < 1000}
                size="lg"
                className="w-full text-lg py-6"
              >
                Apply for Finance
              </Button>

              {loanAmount && parseFloat(loanAmount) < 1000 && (
                <p className="text-sm text-red-600 text-center">Minimum finance amount is £1,000</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-blue-50">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-3">Why Choose Finance?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="bg-white p-4 rounded-lg h-full">
                    <p className="font-medium mb-2">💳 Spread the Cost</p>
                    <p className="text-sm text-gray-600">Affordable monthly payments instead of one large sum</p>
                  </div>
                </div>
                <div>
                  <div className="bg-white p-4 rounded-lg h-full">
                    <p className="font-medium mb-2">⚡ Start Sooner</p>
                    <p className="text-sm text-gray-600">Don't wait to save - get your dream bathroom now</p>
                  </div>
                </div>
                <div>
                  <div className="bg-white p-4 rounded-lg h-full">
                    <p className="font-medium mb-2">✅ Quick Approval</p>
                    <p className="text-sm text-gray-600">Instant decision in most cases</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.customerName}
                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                className="text-lg p-6"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="text-lg p-6"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="text-lg p-6"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="text-lg p-6"
              />
            </div>

            <div>
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                value={formData.postcode}
                onChange={e => setFormData({ ...formData, postcode: e.target.value })}
                className="text-lg p-6"
              />
            </div>

            <div>
              <Label htmlFor="employment">Employment Status</Label>
              <Select value={formData.employmentStatus} onValueChange={(value) => setFormData({ ...formData, employmentStatus: value })}>
                <SelectTrigger className="text-lg p-6">
                  <SelectValue placeholder="Select employment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time" className="text-lg py-3">Full Time Employed</SelectItem>
                  <SelectItem value="part_time" className="text-lg py-3">Part Time Employed</SelectItem>
                  <SelectItem value="self_employed" className="text-lg py-3">Self Employed</SelectItem>
                  <SelectItem value="retired" className="text-lg py-3">Retired</SelectItem>
                  <SelectItem value="other" className="text-lg py-3">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="income">Annual Income (£)</Label>
                <Input
                  id="income"
                  type="number"
                  value={formData.annualIncome}
                  onChange={e => setFormData({ ...formData, annualIncome: e.target.value })}
                  className="text-lg p-6"
                  placeholder="25000"
                />
              </div>
              <div>
                <Label htmlFor="expenses">Monthly Expenses (£)</Label>
                <Input
                  id="expenses"
                  type="number"
                  value={formData.monthlyExpenses}
                  onChange={e => setFormData({ ...formData, monthlyExpenses: e.target.value })}
                  className="text-lg p-6"
                  placeholder="1200"
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mt-4">
              <h4 className="font-medium mb-2">Application Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Loan Amount:</span>
                  <span className="font-bold">£{loanAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Term:</span>
                  <span className="font-bold">{formData.term} months</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Payment:</span>
                  <span className="font-bold">£{monthlyPayment.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={() => setStep(1)} variant="outline" size="lg" className="flex-1 text-lg py-6">
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                size="lg"
                className="flex-1 text-lg py-6 bg-green-600 hover:bg-green-700"
                disabled={!formData.customerName || !formData.email || !formData.employmentStatus}
              >
                Submit Application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-24 h-24 text-green-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-green-900 mb-3">Application Approved!</h2>
            <p className="text-lg text-gray-700 mb-6">
              Finance of £{loanAmount} has been approved for {formData.customerName}
            </p>

            <div className="bg-green-50 p-6 rounded-lg border-2 border-green-500 mb-6">
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-sm text-gray-600">Monthly Payment</p>
                  <p className="text-2xl font-bold text-green-700">£{monthlyPayment.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Term</p>
                  <p className="text-2xl font-bold text-green-700">{formData.term} months</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-xl font-bold text-gray-900">£{loanAmount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">APR</p>
                  <p className="text-xl font-bold text-gray-900">{interestRate}%</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button size="lg" className="w-full text-lg py-6">
                Proceed to Quote
              </Button>
              <Button variant="outline" size="lg" className="w-full text-lg py-6" onClick={() => window.print()}>
                Print Finance Agreement
              </Button>
              <Button variant="outline" size="lg" className="w-full text-lg py-6" onClick={() => setStep(1)}>
                New Application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
