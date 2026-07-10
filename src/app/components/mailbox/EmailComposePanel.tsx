import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Send, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { mailboxService, type MailboxConnection } from '../../engine/mailbox/mailboxService';

interface Props {
  userId: string;
  orgId?: string;
  connection?: MailboxConnection | null;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
}

export function EmailComposePanel({
  userId,
  orgId,
  connection,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
}: Props) {
  const [form, setForm] = useState({
    to: defaultTo,
    subject: defaultSubject,
    body: defaultBody,
  });
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ filename: string; mimeType: string; content: string }>>([]);

  const handleAttach = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    setAttachments(prev => [...prev, {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      content: btoa(binary),
    }]);
  };

  const handleSend = async () => {
    if (!connection?.id) {
      toast.error('Connect a mailbox first');
      return;
    }
    if (!form.to || !form.subject) {
      toast.error('To and subject are required');
      return;
    }
    setSending(true);
    try {
      const result = await mailboxService.send({
        connectionId: connection.id,
        to: form.to,
        subject: form.subject,
        body: form.body,
        attachments: attachments.length ? attachments : undefined,
      }, userId, orgId) as { success?: boolean; error?: string };
      if (result.success) {
        toast.success('Email sent from your connected inbox');
        setAttachments([]);
      }
      else toast.error(result.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compose (connected inbox)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <p className="text-sm text-gray-600">Sending as {connection.emailAddress}</p>
        ) : (
          <p className="text-sm text-amber-700">Connect your mailbox in Settings to send from your own email address.</p>
        )}
        <div>
          <Label>To</Label>
          <Input value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} />
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
        </div>
        <div>
          <Label>Message</Label>
          <Textarea rows={8} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
        </div>
        <div>
          <Label>Attachments</Label>
          <Input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleAttach(file);
              e.target.value = '';
            }}
          />
          {attachments.length > 0 && (
            <ul className="text-xs text-gray-600 mt-2 space-y-1">
              {attachments.map(a => (
                <li key={a.filename} className="flex items-center gap-2">
                  <Paperclip className="w-3 h-3" />
                  {a.filename}
                  <button
                    type="button"
                    className="text-red-600 underline"
                    onClick={() => setAttachments(prev => prev.filter(x => x.filename !== a.filename))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button className="w-full" onClick={() => void handleSend()} disabled={sending || !connection}>
          <Send className="w-4 h-4 mr-2" /> Send from my inbox
        </Button>
      </CardContent>
    </Card>
  );
}
