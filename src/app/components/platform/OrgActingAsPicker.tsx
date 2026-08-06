import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { fetchOrganizations, type PlatformOrganization } from '../../engine/platform/platformApi';
import { getActiveOrgId, setActiveOrgId } from '../../engine/platform/orgContext';
import { setTabletPreview } from '../../engine/platform/experience';
import { DEMO_KITCHEN_ORG_ID, getHomeOrgId } from '../../engine/platform/homeOrg';

function orgLabel(o: { id: string; name: string }): string {
  if (o.id === getHomeOrgId()) return `${o.name} (platform home)`;
  if (o.id === DEMO_KITCHEN_ORG_ID) return `${o.name} (demo kitchen)`;
  return o.name;
}

export default function OrgActingAsPicker() {
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [active, setActive] = useState<string>(() => getActiveOrgId() ?? '');
  const homeOrgId = getHomeOrgId();

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
        onValueChange={(v) => {
          const id = v === '__none__' ? '' : v;
          setActive(id);
          // Switching scope always stays in the IT/sales shell — never the tablet.
          setTabletPreview(false);
          setActiveOrgId(id || null);
          if (!id || id === homeOrgId) {
            window.location.assign('/platform/clients');
            return;
          }
          window.location.assign('/');
        }}
      >
        <SelectTrigger className="h-8 w-[140px] sm:w-[180px] text-xs bg-indigo-900 border-indigo-700 text-white">
          <SelectValue placeholder="Select client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Not acting as a client</SelectItem>
          {orgs.map((o) => (
            <SelectItem key={o.id} value={o.id}>{orgLabel(o)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
