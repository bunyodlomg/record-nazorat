# Record Nazorat — Glassmorphism Dock Edition

Zamonaviy, role-based ta'lim platformasi. **Admin o'qituvchilarni nazorat qiladi**, **o'qituvchi o'quvchilarni nazorat qiladi**.

## ✨ Asosiy xususiyatlar

- 🎨 **Glassmorphism dock navigation** (pastki o'rtada, suzayotgan)
- 🌓 Dark/light tema (default: dark)
- 🔐 JWT auth + role-based UI (admin / teacher)
- 📊 Recharts (BarChart, AreaChart) jonli backenddan
- 🎬 Framer Motion — barcha sahifa o'tishlari, KPI count-up, podium animatsiyalar
- 🪟 Backdrop-filter glass effects
- 🔤 Inter typography

## 🚀 Tez ishga tushirish

```bash
npm run install:all          # client + server dependencies

cd server
cp .env.example .env         # MONGO_URI, JWT_SECRET sozlash
npm run seed                 # demo userlar bilan to'ldirish
cd ..

npm run dev                  # client (5173) + server (5000) bir vaqtda
```

## 🔑 Demo akkauntlar

Login ekranida tugmaga bosish bilan tez to'ldiriladi:

| Role     | Email                     | Parol         |
|----------|---------------------------|----------------|
| Admin    | `admin@recordnazorat.uz`   | `admin123`    |
| Teacher  | `aziza.k@recordnazorat.uz` | `teacher123`  |

Boshqa o'qituvchi userlari ham seed da yaratiladi (parol: `teacher123`).

## 🏗️ Arxitektura

```
record-nazorat/
├── client/                     ← Vite + React + Framer Motion + Recharts
│   ├── src/
│   │   ├── components/
│   │   │   ├── Shell.jsx       Header + Dock
│   │   │   ├── Feedback.jsx    Spinner, ErrorBox, motion variants
│   │   │   └── ui.jsx          Icon, Avatar, ChartTooltip, useCountUp
│   │   ├── context/
│   │   │   └── AuthContext.jsx JWT login state
│   │   ├── hooks/
│   │   │   └── useFetch.js     API hook
│   │   ├── pages/              Admin sahifalari
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Teachers.jsx
│   │   │   ├── TeacherDetail.jsx (Drawer + Detail)
│   │   │   ├── Groups.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Homework.jsx
│   │   │   ├── Calendar.jsx
│   │   │   └── teacher/        Teacher uchun maxsus
│   │   │       ├── MyDashboard.jsx
│   │   │       ├── MyClasses.jsx
│   │   │       └── MyHomework.jsx
│   │   ├── services/api.js
│   │   ├── styles/global.css
│   │   ├── App.jsx             Role-based router
│   │   └── main.jsx
│   └── vite.config.js
│
└── server/                     ← Express + MongoDB
    ├── src/
    │   ├── models/
    │   │   ├── User.js         email/password/role
    │   │   ├── Teacher.js
    │   │   ├── Group.js
    │   │   └── Homework.js
    │   ├── routes/
    │   │   ├── auth.js         /login /register /me
    │   │   ├── dashboard.js
    │   │   ├── teachers.js
    │   │   ├── groups.js
    │   │   └── homework.js
    │   ├── middleware/
    │   │   ├── auth.js         JWT protect, requireRole, selfOrAdmin
    │   │   └── errorHandler.js
    │   ├── config/
    │   │   ├── db.js
    │   │   └── seed.js
    │   └── server.js
    └── .env
```

## 🎯 Role-based UI

### Admin uchun (`role: admin`)
Pastki dock: **Dashboard · Teachers · Groups | Leaderboard · Homework · Calendar**

- Hamma o'qituvchilar
- Hamma guruhlar
- Leaderboard
- Hamma uy vazifalari
- Problem teachers monitoringi

### Teacher uchun (`role: teacher`)
Pastki dock: **Overview · My Classes · Homework | Calendar**

- O'z statistikasi (activity score, attendance)
- Faqat **o'zining** guruhlari
- Faqat **o'zi yaratgan** uy vazifalari
- Quick actions, attendance trend

## 🔐 Auth API

| Method | Endpoint                  | Tavsif              |
|--------|----------------------------|---------------------|
| POST   | `/api/auth/login`          | Email + parol       |
| POST   | `/api/auth/register`       | Yangi user          |
| GET    | `/api/auth/me`             | Joriy user          |
| PATCH  | `/api/auth/me`             | Profil yangilash    |
| POST   | `/api/auth/change-password`| Parol o'zgartirish  |

Tokenni `Authorization: Bearer <token>` header orqali yuboring.

## 🎨 Texnologiyalar

**Client:**
- React 18, Vite 5
- **Framer Motion 11** — page transitions, layout animations, AnimatePresence
- **Recharts 2** — interaktiv grafiklar
- Axios — JWT interceptors
- **Inter** (Google Fonts) — typography

**Server:**
- Express 4 + MongoDB + Mongoose 8
- JWT + bcryptjs + helmet + rate-limit + express-validator
