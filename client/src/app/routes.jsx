import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { GuestOnly, MessagesRedirect, RequireAuth } from '../components/common/RouteGuards';
import { RouteProgress } from '../components/common/SiteChrome';
import { PageLoader } from '../components/ui';

// Code-split every page so the first load stays small.
const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const Home = page(() => import('../pages/public/Home'), 'Home');
const RoadmapLibrary = page(() => import('../pages/public/RoadmapLibrary'), 'RoadmapLibrary');
const PublicRoadmap = page(() => import('../pages/public/PublicRoadmap'), 'PublicRoadmap');
const Faq = page(() => import('../pages/public/Faq'), 'Faq');
const Contact = page(() => import('../pages/public/Contact'), 'Contact');
const Privacy = page(() => import('../pages/public/Legal'), 'Privacy');
const Terms = page(() => import('../pages/public/Legal'), 'Terms');
const Cookies = page(() => import('../pages/public/Legal'), 'CookiePolicy');
const NotFound = page(() => import('../pages/public/NotFound'), 'NotFound');

const Login = page(() => import('../pages/auth/Login'), 'Login');
const Register = page(() => import('../pages/auth/Register'), 'Register');
const MentorApply = page(() => import('../pages/auth/MentorApply'), 'MentorApply');
const ForgotPassword = page(() => import('../pages/auth/TokenPages'), 'ForgotPassword');
const ResetPassword = page(() => import('../pages/auth/TokenPages'), 'ResetPassword');
const VerifyEmail = page(() => import('../pages/auth/TokenPages'), 'VerifyEmail');
const AcceptInvite = page(() => import('../pages/auth/TokenPages'), 'AcceptInvite');
const Unsubscribe = page(() => import('../pages/auth/TokenPages'), 'Unsubscribe');

const StudentHome = page(() => import('../pages/student/StudentHome'), 'StudentHome');
const RoadmapPage = page(() => import('../pages/student/RoadmapPage'), 'RoadmapPage');
const RoadmapDetail = page(() => import('../pages/student/RoadmapDetail'), 'RoadmapDetail');
const StudentOpportunities = page(() => import('../pages/student/StudentOpportunities'), 'StudentOpportunities');
const Connect = page(() => import('../pages/student/Connect'), 'Connect');
const Wellness = page(() => import('../pages/student/Wellness'), 'Wellness');
const StudentProfile = page(() => import('../pages/student/StudentProfile'), 'StudentProfile');

const StudentTests = page(() => import('../pages/student/StudentTests'), 'StudentTests');
const TestAttempt = page(() => import('../pages/student/TestTaker'), 'TestAttempt');
const PracticeRun = page(() => import('../pages/student/TestTaker'), 'PracticeRun');

const MentorHome = page(() => import('../pages/mentor/MentorHome'), 'MentorHome');
const MentorStudents = page(() => import('../pages/mentor/MentorStudents'), 'MentorStudents');
const MentorMessages = page(() => import('../pages/mentor/MentorMessages'), 'MentorMessages');
const MentorProfile = page(() => import('../pages/mentor/MentorProfile'), 'MentorProfile');

const AdminOverview = page(() => import('../pages/admin/AdminOverview'), 'AdminOverview');
const AdminStudents = page(() => import('../pages/admin/AdminStudents'), 'AdminStudents');
const AdminMentors = page(() => import('../pages/admin/AdminMentors'), 'AdminMentors');
const AdminContent = page(() => import('../pages/admin/AdminContent'), 'AdminContent');
const AdminSystem = page(() => import('../pages/admin/AdminSystem'), 'AdminSystem');
const AdminTests = page(() => import('../pages/admin/AdminTests'), 'AdminTests');
const CommunityChat = page(() => import('../pages/admin/CommunityChat'), 'CommunityChat');
const AdminProfile = page(() => import('../pages/admin/AdminProfile'), 'AdminProfile');

const SessionsManager = page(() => import('../pages/shared/SessionsManager'), 'SessionsManager');
const OpportunitiesManager = page(() => import('../pages/shared/OpportunitiesManager'), 'OpportunitiesManager');
const MeetingRoom = page(() => import('../pages/shared/MeetingRoom'), 'MeetingRoom');

const Lazy = ({ children }) => (
  <Suspense
    fallback={
      <>
        <RouteProgress />
        <PageLoader />
      </>
    }
  >
    {children}
  </Suspense>
);

export function AppRoutes() {
  return (
    <Lazy>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="roadmaps" element={<RoadmapLibrary />} />
          <Route path="roadmaps/:slug" element={<PublicRoadmap />} />
          <Route path="faq" element={<Faq />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="cookies" element={<Cookies />} />
          <Route path="unsubscribe/:token" element={<Unsubscribe />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="mentor-apply" element={<GuestOnly><MentorApply /></GuestOnly>} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password/:token" element={<ResetPassword />} />
        <Route path="verify-email/:token" element={<VerifyEmail />} />
        <Route path="accept-invite/:token" element={<AcceptInvite />} />
        <Route path="messages" element={<RequireAuth><MessagesRedirect /></RequireAuth>} />

        <Route path="app" element={<RequireAuth roles={['student']}><DashboardLayout /></RequireAuth>}>
          <Route index element={<StudentHome />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="roadmap/:slug" element={<RoadmapDetail />} />
          <Route path="opportunities" element={<StudentOpportunities />} />
          <Route path="tests" element={<StudentTests />} />
          <Route path="tests/attempt/:id" element={<TestAttempt />} />
          <Route path="tests/practice/:id" element={<PracticeRun />} />
          <Route path="connect" element={<Connect />} />
          <Route path="wellness" element={<Wellness />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="*" element={<NotFound inApp />} />
        </Route>

        <Route path="mentor" element={<RequireAuth roles={['mentor']}><DashboardLayout /></RequireAuth>}>
          <Route index element={<MentorHome />} />
          <Route path="students" element={<MentorStudents />} />
          <Route path="messages" element={<MentorMessages />} />
          <Route path="sessions" element={<SessionsManager />} />
          <Route path="opportunities" element={<OpportunitiesManager />} />
          <Route path="profile" element={<MentorProfile />} />
          <Route path="*" element={<NotFound inApp />} />
        </Route>

        <Route path="admin" element={<RequireAuth roles={['admin']}><DashboardLayout /></RequireAuth>}>
          <Route index element={<AdminOverview />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="mentors" element={<AdminMentors />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="sessions" element={<SessionsManager />} />
          <Route path="tests" element={<AdminTests />} />
          <Route path="communities/:id" element={<CommunityChat />} />
          <Route path="system" element={<AdminSystem />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="*" element={<NotFound inApp />} />
        </Route>

        <Route path="meet/:id" element={<RequireAuth><MeetingRoom /></RequireAuth>} />
      </Routes>
    </Lazy>
  );
}
