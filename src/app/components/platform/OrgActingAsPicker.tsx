import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { fetchOrganizations, type PlatformOrganization } from '../../engine/platform/platformApi';
import { getActiveOrgId, setActiveOrgId } from '../../engine/platform/orgContext';

export default function OrgActingAsPicker() {
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [active, setActive] = useState<string>(() => getActiveOrgId() ?? '');

  useEffect(() => {
    fetchOrganizations()
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, []);

  if (orgs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700/50">
      <span className="text-[10px] uppercase tracking-wide text-indigo-300 hidden sm:inline">Acting as</span>
      <Select
        value={active || '__none__'}
        onValueChange={v => {
          const id = v === '__none__' ? '' : v;
          setActive(id);
          setActiveOrgId(id || null);
        }}
      >
        <SelectTrigger className="h-8 w-[140px] sm:w-[180px] text-xs bg-indigo-900 border-indigo-700 text-white">
          <SelectValue placeholder="Select client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Default (env key)</SelectItem>
          {orgs.map(o => (
            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
