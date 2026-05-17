# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Til va muloqot qoidalari

- Har doim foydalanuvchi bilan o'zbek tilida gaplash.
- Texnik terminlarni kerak bo'lsa inglizcha qoldir, lekin tushuntirishni o'zbekcha yoz.
- Javoblarni qisqa, aniq va amaliy yoz.
- Keraksiz uzun nazariy tushuntirishlardan qoch.
- Muammo bo'lsa sababini va yechimini bosqichma-bosqich tushuntir.
- Kod yozayotganda professional developer kabi ish tut.

## Kod yozish standartlari

- Clean Code prinsiplariga amal qil.
- Kodni modular yoz.
- Takrorlanuvchi kodlardan qoch.
- Har bir funksiyaning vazifasi bitta bo'lsin.
- O'zgaruvchi nomlarini tushunarli qo'y.
- Keraksiz comment yozma; muhim joylarga qisqa va foydali comment yoz.
- Kod production-ready holatda bo'lsin.

## Frontend qoidalari (React)

- Functional component va Hooks ishlat.
- Keraksiz re-renderlardan qoch.
- State managementni tartibli qil.
- Componentlarni reusable yoz.
- Props destructuring ishlat.
- Async holatlarni loading/error bilan boshqar.

## UI/UX qoidalari

- Zamonaviy, minimal va professional SaaS uslubidagi dizayn.
- Responsive, mobile-first.
- Ranglar bir xil theme asosida.
- **Diqqat:** loyiha hozir Tailwind ishlatmaydi — `client/src/styles/global.css` + inline style + CSS o'zgaruvchilar (`var(--teal-l)` va h.k.) bilan yozilgan. Yangi sahifalarda mavjud uslubga moslash, Tailwind kiritmaslik (agar foydalanuvchi alohida so'ramasa).

## Backend qoidalari (Node.js / Express)

- MVC ruhi: route, validation, model va biznes-mantiqni ajratib yoz.
- `async/await` + `try/catch` (yoki mavjud `asyncHandler` wrapper).
- Har bir write endpoint uchun `express-validator` validation.
- Xatoliklarni markaziy `errorHandler` orqali qaytar.
- Response format doim bir xil:

```json
{ "success": true, "message": "Success", "data": {} }
```

Xatolikda: `{ "success": false, "message": "..." }` (kerak bo'lsa `errors` array bilan).

---

# Loyiha haqida

## Layout

Ikki paketli monorepo (workspace tooling yo'q — har bir paket alohida o'rnatiladi):

- `client/` — React 18 + Vite SPA (admin & teacher console)
- `server/` — Express + MongoDB (Mongoose) REST API

Yuqori darajadagi `package.json` yo'q; barcha komandalar tegishli paket ichidan ishga tushiriladi.

## Common commands

### Server (`cd server`)
- `npm install` — paketlarni o'rnatish
- `npm run seed` — Mongo'ni tozalab demo teachers, groups, homework, users bilan to'ldirish (destructive — barcha datani o'chiradi)
- `npm run dev` — nodemon (`src/server.js`, port `5000`)
- `npm start` — production

Server `server/.env` talab qiladi (`MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`). Local dev uchun `.env` allaqachon mavjud (`mongodb://localhost:27017/recordnazorat`).

### Client (`cd client`)
- `npm install`
- `npm run dev` — Vite (`5173`). `/api/*` `http://localhost:5000` ga proxy qilinadi (`client/vite.config.js`), shuning uchun server ishlab turishi shart.
- `npm run build` / `npm run preview`

Test, lint, typecheck skriptlari sozlanmagan.

### Birinchi marta ishga tushirish
1. MongoDB `server/.env` dagi URI bo'yicha ishlab tursin.
2. `cd server && npm install && npm run seed && npm run dev`
3. `cd client && npm install && npm run dev`
4. Login sahifasidagi demo akkauntlardan biri bilan kir:
   - Admin: `admin@recordnazorat.uz` / `admin123`
   - Teacher: `aziza.k@recordnazorat.uz` / `teacher123`

Agar login `401 Invalid email or password` qaytarsa — DB seed qilinmagan, `npm run seed` ni server ichida ishga tushir.

## Architecture

### Role-based dual UI (client)
`client/src/App.jsx` — kirish nuqtasi. **react-router yo'q** — sahifalar oddiy `useState` orqali ikkita yuqori darajadagi component ichida almashtiriladi:

- `AdminApp` — dashboard, teachers, groups, leaderboard, homework, calendar. Admin sahifalari `TeacherDrawer` (slide-over) yoki to'liq `TeacherDetailPage` ni ham ocha oladi.
- `TeacherApp` — o'qituvchining o'z dashboard, classes, homework, calendar.

`App` `user.role === 'admin'` orqali tanlaydi. Yangi sahifa qo'shish uchun: dock array ga (`ADMIN_DOCK` / `TEACHER_DOCK`) yangi item qo'sh, page componentni import qil, page-switch ladder ga yangi shart qo'sh.

### Auth flow
- `client/src/context/AuthContext.jsx` — current user uchun yagona manba. JWT `localStorage` da `ep_token` kalit ostida saqlanadi va mount paytida `GET /api/auth/me` orqali qayta tekshiriladi.
- Barcha HTTP `client/src/services/api.js` axios instance orqali ketadi: `Authorization: Bearer <token>` avtomatik qo'shiladi, `401` da token tozalanadi. Response interceptor `res.data` ni yechib beradi — ya'ni `api.auth.login(...)` to'g'ridan-to'g'ri `{ success, token, data }` qaytaradi, axios response emas. Yangi endpointlarni shu yerdagi `api` obyektiga qo'sh, componentlardan to'g'ridan-to'g'ri axios chaqirma.
- Server tomonida `server/src/middleware/auth.js`: `protect` (JWT verify), `requireRole(...roles)`, `selfOrAdmin` (teacher faqat `req.user.teacherRef === :id` bo'lganda kira oladi).

### Domain model
- `User` (auth identity) ↔ `Teacher` (domain record) — **alohida collection**, `User.teacherRef` orqali bog'langan. Seed bitta admin `User` va har bir `Teacher` uchun `role: 'teacher'` li `User` yaratadi. JWT payload `teacherRef` ni olib yuradi — teacher-scoped route'larda `req.user.teacherRef` ishlatiladi, `req.user.id` emas.
- `Teacher` modelida `pre('save')` hook `tasksUnchecked` va `attendance` dan `problem` ni hisoblab qo'yadi — `problem` ni qo'lda yozma, inputlarni yangila.
- `Homework.col` — kanban ustun (`pending` | `checking` | `done`); ustun almashtirish uchun maxsus endpoint: `PATCH /api/homework/:id/move`.

### API surface
Routelar `server/src/server.js` da `/api/{auth,dashboard,teachers,groups,homework}` ostida mount qilingan. Write endpointlar `express-validator` ishlatadi va `ok` middleware orqali `422` qaytaradi. Handler ichida `throw` ishlasin uchun barchasi `asyncHandler` (`server/src/middleware/errorHandler.js`) ga o'ralgan.

### Styling & UI
- Yagona `client/src/styles/global.css` + componentlardagi inline style. CSS modules / Tailwind yo'q.
- Theme `<html data-theme="dark|light">` atribut + `localStorage.ep_theme` orqali (`App.jsx`).
- `framer-motion` page/drawer animatsiyalari uchun keng ishlatiladi; qayta ishlatiladigan UI primitivlar `client/src/components/{ui,Shell,Feedback}.jsx` da.
- `recharts` — dashboard va leaderboard chartlari.
