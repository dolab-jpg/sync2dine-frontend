import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { FileText, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { UnifiedProject } from '../../engine/project/types';
import { generateInvoicePdf, generateContractPdf } from '../../engine/messaging/pdfGenerator';
import { messagingHub } from '../../engine/messaging/messagingHub';
import { updateProject } from '../../engine/project/projectStore';

interface Props {
  project: UnifiedProject;
  customerPhone?: string;
  customerWhatsappOptIn?: boolean;
  onUpdate: (project: UnifiedProject) => void;
}

export function ProjectDocumentsTab({ project, customerPhone, customerWhatsappOptIn, onUpdate }: Props) {
  const portalUrl = `${window.location.origin}/portal/${project.portalToken}`;

  const sendInvoice = async (invoiceId: string) => {
    const inv = project.invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const pdf = generateInvoicePdf(
      project.customerName,
      project.projectName,
      inv.lineItems,
      inv.total,
      inv.id
    );
    await messagingHub.send({
      channels: ['email', 'whatsapp'],
      to: {
        email: project.customerEmail,
        phone: customerPhone,
        customerId: project.customerId,
        customerName: project.customerName,
      },
      subject: `Invoice ${inv.id} — ${project.projectName}`,
      body: `Your invoice for ${project.projectName} is ready. Total: £${inv.total.toFixed(2)}. View full details: ${portalUrl}`,
      eventType: 'invoice',
      attachment: pdf,
      templateId: 'invoice_ready',
    }, { whatsappOptIn: customerWhatsappOptIn ?? true, email: project.customerEmail, phone: customerPhone ?? '', preferredChannel: 'both' });

    const invoices = project.invoices.map(i =>
      i.id === invoiceId ? { ...i, status: 'sent' as const, sentAt: new Date().toISOString(), pdfPath: pdf.filename } : i
    );
    onUpdate(updateProject(project.id, { invoices })!);
    toast.success('Invoice sent');
  };

  const sendContract = async (contractId: string) => {
    const con = project.contracts.find(c => c.id === contractId);
    if (!con) return;
    const pdf = generateContractPdf(project.customerName, project.projectName, con.terms, project.totalCustomerCost);
    await messagingHub.send({
      channels: ['email', 'whatsapp'],
      to: {
        email: project.customerEmail,
        phone: customerPhone,
        customerId: project.customerId,
        customerName: project.customerName,
      },
      subject: `Contract — ${project.projectName}`,
      body: `Please review your contract for ${project.projectName}. Portal: ${portalUrl}`,
      eventType: 'custom',
      attachment: pdf,
      templateId: 'contract_ready',
    }, { whatsappOptIn: customerWhatsappOptIn ?? true, email: project.customerEmail, phone: customerPhone ?? '', preferredChannel: 'both' });

    const contracts = project.contracts.map(c =>
      c.id === contractId ? { ...c, status: 'sent' as const, pdfPath: pdf.filename } : c
    );
    onUpdate(updateProject(project.id, { contracts })!);
    toast.success('Contract sent');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {project.invoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices. Use Project AI to draft one.</p>
          ) : (
            project.invoices.map(inv => (
              <div key={inv.id} className="flex justify-between items-center p-2 border rounded">
                <div>
                  <p className="text-sm font-medium">{inv.id}</p>
                  <p className="text-xs text-slate-500">£{inv.total.toFixed(2)} · {inv.status}</p>
                </div>
                {inv.status === 'draft' && (
                  <Button size="sm" variant="outline" onClick={() => sendInvoice(inv.id)}>
                    <Send className="w-3 h-3 mr-1" /> Send
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Contracts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {project.contracts.length === 0 ? (
            <p className="text-sm text-slate-500">No contracts. Use Project AI to draft one.</p>
          ) : (
            project.contracts.map(con => (
              <div key={con.id} className="p-2 border rounded space-y-2">
                <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">{con.terms}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">{con.status}</span>
                  {con.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => sendContract(con.id)}>
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500">Customer portal: {portalUrl}</p>
    </div>
  );
}
