import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './context/AuthContext.jsx';
import { Header, Dock } from './components/Shell.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import { PendingScreen, RejectedScreen, NoInviteScreen } from './components/StatusScreens.jsx';
import { isTelegram, useBackButton } from './hooks/useTelegram.js';
import LoginPage from './pages/Login.jsx';

// Admin pages
import DashboardPage from './pages/Dashboard.jsx';
import TeachersPage from './pages/Teachers.jsx';
import { TeacherDrawer, TeacherDetailPage } from './pages/TeacherDetail.jsx';
import StudentDetailPage from './pages/StudentDetail.jsx';
import GroupsPage from './pages/Groups.jsx';
import GroupDetailPage from './pages/GroupDetail.jsx';
import LeaderboardPage from './pages/Leaderboard.jsx';
import HomeworkPage from './pages/Homework.jsx';
import HomeworkDetailPage from './pages/HomeworkDetail.jsx';
import CalendarPage from './pages/Calendar.jsx';
import SettingsPage from './pages/Settings.jsx';

// Teacher pages
import MyDashboard from './pages/teacher/MyDashboard.jsx';
import MyClasses   from './pages/teacher/MyClasses.jsx';
import MyHomework  from './pages/teacher/MyHomework.jsx';
import ActivityGrid from './pages/teacher/ActivityGrid.jsx';
import PendingUsersPage from './pages/PendingUsers.jsx';


const ADMIN_DOCK = [
  { id:'dashboard',   label:'Bosh sahifa',   icon:'dashboard' },
  { id:'teachers',    label:"O'qituvchilar", icon:'teachers' },
  { id:'groups',      label:'Guruhlar',      icon:'groups' },
  { divider:true },
  { id:'leaderboard', label:'Reyting',       icon:'trophy' },
  { id:'calendar',    label:'Kalendar',      icon:'calendar' },
  { id:'gems',        label:'Olmoslar',      icon:'gem' },
];

const TEACHER_DOCK = [
  { id:'dashboard',  label:'Bosh sahifa',         icon:'dashboard' },
  { id:'my-classes', label:'Mening guruhlarim',   icon:'groups' },
  { id:'my-homework',label:'Vazifalar',            icon:'homework' },
  { id:'activity',   label:'Faollik jadvali',     icon:'grid' },
  { divider:true },
  { id:'calendar',   label:'Kalendar',            icon:'calendar' },
];

function AdminApp() {
  const [page,       setPage]       = useState('dashboard');
  const [drawerId,   setDrawerId]   = useState(null);
  const [detailId,   setDetailId]   = useState(null);
  const [studentId,  setStudentId]  = useState(null);
  const [homeworkId, setHomeworkId] = useState(null);
  const [groupId,    setGroupId]    = useState(null);

  const nav = id => { setPage(id); setDetailId(null); setDrawerId(null); setStudentId(null); setHomeworkId(null); setGroupId(null); };

  // Telegram BackButton — drawer yoki detail ochiq bo'lsa orqaga qaytadi
  const backHandler =
    studentId  ? () => setStudentId(null) :
    homeworkId ? () => setHomeworkId(null) :
    groupId    ? () => setGroupId(null) :
    detailId   ? () => setDetailId(null) :
    drawerId   ? () => setDrawerId(null) :
    page !== 'dashboard' ? () => setPage('dashboard') :
    null;
  useBackButton(backHandler);

  let content;
  if (studentId) {
    content = <StudentDetailPage studentId={studentId} onBack={() => setStudentId(null)}/>;
  } else if (homeworkId) {
    content = <HomeworkDetailPage homeworkId={homeworkId} onBack={() => setHomeworkId(null)}/>;
  } else if (groupId) {
    content = <GroupDetailPage groupId={groupId} onBack={() => setGroupId(null)}
      onOpenStudent={setStudentId} onOpenHomework={setHomeworkId} onOpenTeacher={setDetailId}/>;
  } else if (detailId) {
    content = <TeacherDetailPage teacherId={detailId} onBack={() => setDetailId(null)} onOpenGroup={setGroupId}/>;
  } else if (page === 'dashboard')   content = <DashboardPage   onOpenTeacher={setDetailId} onOpenStudent={setStudentId} onNav={nav}/>;
  else if (page === 'teachers')      content = <TeachersPage    onOpenTeacher={setDetailId} onOpenStudent={setStudentId}/>;
  else if (page === 'groups')        content = <GroupsPage      onOpenTeacher={setDetailId} onOpenGroup={setGroupId}/>;
  else if (page === 'leaderboard')   content = <LeaderboardPage onOpenTeacher={setDetailId} onOpenStudent={setStudentId}/>;
  else if (page === 'homework')      content = <HomeworkPage onOpenHomework={setHomeworkId} onOpenTeacher={setDetailId}/>;
  else if (page === 'calendar')      content = <CalendarPage onOpenTeacher={setDetailId}/>;
  else if (page === 'gems')          content = <SettingsPage/>;

  return (
    <>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
        {content}
      </div>

      <AnimatePresence>
        {drawerId && (
          <TeacherDrawer
            teacherId={drawerId}
            onClose={() => setDrawerId(null)}
            onOpenFull={() => { setDetailId(drawerId); setDrawerId(null); }}
          />
        )}
      </AnimatePresence>

      <Dock items={ADMIN_DOCK} active={page} onChange={nav}/>
    </>
  );
}

function TeacherApp() {
  const [page, setPage] = useState('dashboard');
  const [studentId,  setStudentId]  = useState(null);
  const [homeworkId, setHomeworkId] = useState(null);
  const [groupId,    setGroupId]    = useState(null);

  const backHandler =
    studentId  ? () => setStudentId(null) :
    homeworkId ? () => setHomeworkId(null) :
    groupId    ? () => setGroupId(null) :
    page !== 'dashboard' ? () => setPage('dashboard') :
    null;
  useBackButton(backHandler);

  const nav = id => { setPage(id); setStudentId(null); setHomeworkId(null); setGroupId(null); };

  let content;
  if (studentId) {
    content = <StudentDetailPage studentId={studentId} onBack={() => setStudentId(null)}/>;
  } else if (homeworkId) {
    content = <HomeworkDetailPage homeworkId={homeworkId} onBack={() => setHomeworkId(null)}/>;
  } else if (groupId) {
    content = <GroupDetailPage groupId={groupId} onBack={() => setGroupId(null)}
      onOpenStudent={setStudentId} onOpenHomework={setHomeworkId}/>;
  } else if (page === 'dashboard')        content = <MyDashboard onNav={nav}/>;
  else if (page === 'my-classes')  content = <MyClasses onOpenStudent={setStudentId} onOpenGroup={setGroupId}/>;
  else if (page === 'my-homework') content = <MyHomework onOpenHomework={setHomeworkId}/>;
  else if (page === 'activity')    content = <ActivityGrid/>;
  else if (page === 'calendar')    content = <CalendarPage/>;

  return (
    <>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
        {content}
      </div>
      <Dock items={TEACHER_DOCK} active={page} onChange={nav}/>
    </>
  );
}

export default function App() {
  const { user, status, error, logout, refresh } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('ep_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ep_theme', theme);
  }, [theme]);

  if (status === 'booting') {
    return <LoadingScreen label="Yuklanmoqda..."/>;
  }

  if (status === 'pending') {
    return <PendingScreen onRefresh={refresh} onLogout={logout}/>;
  }

  if (status === 'rejected') {
    return <RejectedScreen onLogout={logout}/>;
  }

  if (status === 'no-invite') {
    return <NoInviteScreen onLogout={isTelegram ? null : logout} error={error}/>;
  }

  if (status === 'guest' || !user) {
    return (
      <>
        <div className="app-bg"/>
        <LoginPage/>
      </>
    );
  }

  return (
    <>
      <div className="app-bg"/>
      <div className="shell">
        <Header
          theme={theme}
          onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          page={null}
        />
        <main className="main">
          {user.role === 'admin' ? <AdminApp/> : <TeacherApp/>}
        </main>
      </div>
    </>
  );
}
