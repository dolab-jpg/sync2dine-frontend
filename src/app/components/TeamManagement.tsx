import { useState, useContext } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Users, Plus, Trash2, Edit2, Mail, Phone, Shield, UserPlus, Landmark } from 'lucide-react';
import { testSalesStaff, testManagers } from '../data/testData';

export default function TeamManagement() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user, recruitmentAccess, setRecruitmentAccess, accountsAccess, setAccountsAccess } = context;
  // Combine managers and staff from test data
  const [teamMembers, setTeamMembers] = useState(() => {
    return [...testManagers, ...testSalesStaff];
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'staff' as 'manager' | 'staff',
    phone: '',
    password: ''
  });

  if (user.role !== 'super_admin' && user.role !== 'platform_owner') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Only super administrators can manage team members.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      setTeamMembers(teamMembers.map(member =>
        member.id === editingId
          ? { ...member, ...formData }
          : member
      ));
    } else {
      const newMember = {
        id: Date.now().toString(),
        ...formData,
        status: 'active' as const
      };
      setTeamMembers([...teamMembers, newMember]);
    }

    setFormData({ name: '', email: '', role: 'staff', phone: '', password: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (member: typeof teamMembers[0]) => {
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      phone: member.phone,
      password: ''
    });
    setEditingId(member.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      setTeamMembers(teamMembers.filter(m => m.id !== id));
    }
  };

  const getRoleBadge = (role: 'manager' | 'staff') => {
    return role === 'manager'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-green-100 text-green-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                Team Management
              </h1>
              <p className="text-amber-100 mt-2 text-lg">Manage your sales team and permissions</p>
            </div>
            <Button
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                setFormData({ name: '', email: '', role: 'staff', phone: '', password: '' });
              }}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-6 text-lg rounded-2xl shadow-lg"
            >
              <Plus className="w-6 h-6 mr-2" />
              Add Team Member
            </Button>
          </div>
        </div>

        {showForm && (
          <Card className="mb-6 shadow-xl border-2 border-amber-500">
            <CardHeader>
              <CardTitle className="text-2xl">
                {editingId ? 'Edit Team Member' : 'Add New Team Member'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-lg mb-2 block">Full Name</Label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Smith"
                      className="h-14 text-lg"
                    />
                  </div>

                  <div>
                    <Label className="text-lg mb-2 block">Email Address</Label>
                    <Input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@bathroompo.com"
                      className="h-14 text-lg"
                    />
                  </div>

                  <div>
                    <Label className="text-lg mb-2 block">Phone Number</Label>
                    <Input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="07700 900000"
                      className="h-14 text-lg"
                    />
                  </div>

                  <div>
                    <Label className="text-lg mb-2 block">Role</Label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as 'manager' | 'staff' })}
                      className="w-full h-14 px-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-lg mb-2 block">
                      {editingId ? 'New Password (leave blank to keep current)' : 'Password'}
                    </Label>
                    <Input
                      type="password"
                      required={!editingId}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="h-14 text-lg"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-6 text-lg rounded-xl"
                  >
                    {editingId ? 'Update Member' : 'Add Member'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setFormData({ name: '', email: '', role: 'staff', phone: '', password: '' });
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-6 text-lg rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Users className="w-7 h-7" />
              Team Members ({teamMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadge(member.role)}`}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span>{member.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{member.phone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleEdit(member)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-xl"
                      >
                        <Edit2 className="w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(member.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-xl"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <UserPlus className="w-7 h-7" />
              Recruitment Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              Grant sales/office staff and managers access to the Recruitment module so they can
              post jobs, track candidates and manage onboarding. Enabled users will see a
              <span className="font-medium"> Recruit</span> option in their sidebar.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-green-900">Sales / Office Staff</h3>
                  <p className="text-sm text-green-800">Allow staff members to access recruitment.</p>
                </div>
                <Switch
                  checked={recruitmentAccess.staff}
                  onCheckedChange={(checked) =>
                    setRecruitmentAccess({ ...recruitmentAccess, staff: checked })
                  }
                  className="scale-150"
                  aria-label="Allow staff to access recruitment"
                />
              </div>
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-blue-900">Managers</h3>
                  <p className="text-sm text-blue-800">Allow managers to access recruitment.</p>
                </div>
                <Switch
                  checked={recruitmentAccess.manager}
                  onCheckedChange={(checked) =>
                    setRecruitmentAccess({ ...recruitmentAccess, manager: checked })
                  }
                  className="scale-150"
                  aria-label="Allow managers to access recruitment"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 shadow-xl border-2 border-indigo-500">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Landmark className="w-7 h-7" />
              Accounts Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              Grant managers and staff access to the Accounts module — bank feed, P&amp;L, job costing,
              and client payment receipts. This section is hidden from customers and builders.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-indigo-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-indigo-900">Managers</h3>
                  <p className="text-sm text-indigo-800">Allow managers to view accounts and financials.</p>
                </div>
                <Switch
                  checked={accountsAccess.manager}
                  onCheckedChange={(checked) =>
                    setAccountsAccess({ ...accountsAccess, manager: checked })
                  }
                  className="scale-150"
                  aria-label="Allow managers to access accounts"
                />
              </div>
              <div className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-violet-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-violet-900">Sales / Office Staff</h3>
                  <p className="text-sm text-violet-800">Allow staff to view accounts when granted.</p>
                </div>
                <Switch
                  checked={accountsAccess.staff}
                  onCheckedChange={(checked) =>
                    setAccountsAccess({ ...accountsAccess, staff: checked })
                  }
                  className="scale-150"
                  aria-label="Allow staff to access accounts"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-2xl">Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Manager
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    View all team quotes and customers
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    Create and edit quotes
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    Manage leads and CRM
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    View sales reports
                  </li>
                </ul>
              </div>

              <div className="bg-green-50 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-green-900 mb-3 flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Staff
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    View own quotes and customers
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    Create quotes
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    Manage assigned leads
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    Limited reporting access
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
