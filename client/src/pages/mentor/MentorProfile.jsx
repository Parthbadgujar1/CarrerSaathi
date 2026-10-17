import { useSearchParams } from 'react-router-dom';
import { Settings, UserCircle } from 'lucide-react';
import { PageTitle } from '../../components/common/PageTitle';
import { Tabs } from '../../components/ui';
import { ProfileForm } from '../../components/profile/ProfileForm';
import { AccountSettings } from '../../components/profile/AccountSettings';

/** Profile page for mentors and admins (no career kit / resume). */
export function StaffProfile() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'settings' ? 'settings' : 'profile';
  return (
    <>
      <PageTitle title="Profile" subtitle="Your public details and account security." />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'profile', label: 'Profile', icon: UserCircle },
          { value: 'settings', label: 'Account & privacy', icon: Settings },
        ]}
      />
      {tab === 'profile' ? <ProfileForm /> : <AccountSettings />}
    </>
  );
}

export const MentorProfile = StaffProfile;
