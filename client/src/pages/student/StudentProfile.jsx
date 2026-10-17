import { useSearchParams } from 'react-router-dom';
import { FileText, ListChecks, Settings, UserCircle } from 'lucide-react';
import { PageTitle } from '../../components/common/PageTitle';
import { Tabs } from '../../components/ui';
import { ProfileForm } from '../../components/profile/ProfileForm';
import { AccountSettings } from '../../components/profile/AccountSettings';
import { CareerKit } from '../../components/profile/CareerKit';
import { ResumeBuilder } from '../../components/profile/ResumeBuilder';

export function StudentProfile() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'profile';
  return (
    <>
      <PageTitle title="Profile" subtitle="Your details, industry-readiness checklist, resume and account settings." />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'profile', label: 'Profile', icon: UserCircle },
          { value: 'kit', label: 'Career kit', icon: ListChecks },
          { value: 'resume', label: 'Resume', icon: FileText },
          { value: 'settings', label: 'Account & privacy', icon: Settings },
        ]}
      />
      {tab === 'profile' && <ProfileForm />}
      {tab === 'kit' && <CareerKit />}
      {tab === 'resume' && <ResumeBuilder />}
      {tab === 'settings' && <AccountSettings />}
    </>
  );
}
