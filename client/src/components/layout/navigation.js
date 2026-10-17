import {
  BarChart3, Briefcase, CalendarDays, ClipboardCheck, Compass, GraduationCap, HeartPulse, Home, Layers, MessagesSquare, Settings, UserCircle, Users,
} from 'lucide-react';

/** Deliberately short sidebars (7 items per role) to keep the UI calm and focused. */
export const NAV_BY_ROLE = {
  student: [
    { to: '/app', label: 'Home', icon: Home, end: true },
    { to: '/app/roadmap', label: 'Roadmap', icon: Compass },
    { to: '/app/opportunities', label: 'Opportunities', icon: Briefcase },
    { to: '/app/tests', label: 'Tests', icon: ClipboardCheck },
    { to: '/app/connect', label: 'Connect', icon: MessagesSquare, badge: 'messages' },
    { to: '/app/wellness', label: 'Wellness', icon: HeartPulse },
    { to: '/app/profile', label: 'Profile', icon: UserCircle },
  ],
  mentor: [
    { to: '/mentor', label: 'Home', icon: Home, end: true },
    { to: '/mentor/students', label: 'Students', icon: GraduationCap },
    { to: '/mentor/messages', label: 'Messages', icon: MessagesSquare, badge: 'messages' },
    { to: '/mentor/sessions', label: 'Sessions', icon: CalendarDays },
    { to: '/mentor/opportunities', label: 'Opportunities', icon: Briefcase },
    { to: '/mentor/profile', label: 'Profile', icon: UserCircle },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/mentors', label: 'Mentors', icon: Users },
    { to: '/admin/content', label: 'Content', icon: Layers },
    { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
    { to: '/admin/tests', label: 'Tests', icon: ClipboardCheck },
    { to: '/admin/system', label: 'System', icon: Settings },
  ],
};

export const PROFILE_PATH = { student: '/app/profile', mentor: '/mentor/profile', admin: '/admin/profile' };
