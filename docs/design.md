# Design: ระบบติดตามงานทีม

เอกสารนี้แปลง `docs/plan.md` และ `docs/requirements.md` เป็นแบบออกแบบสำหรับการพัฒนา โดยยึดขอบเขต US-1 ถึง US-4 เป็น MVP บังคับ และ US-5 ถึง US-6 เป็นงานเสริม การตัดสินใจทุกข้อด้านล่างต้องไม่ลดทอนเกณฑ์ยอมรับ (AC) หรือข้อกำหนดร่วม (NFR)

## 1. ภาพรวมสถาปัตยกรรม

ระบบเป็นเว็บ Next.js 16 แบบ App Router เขียนด้วย TypeScript และ Tailwind CSS เชื่อม Supabase สำหรับ Authentication และ PostgreSQL และ deploy บน Vercel

```text
Browser (publishable key เท่านั้น)
  ├─ Next.js Client Components: ฟอร์มและการโต้ตอบ
  ├─ Next.js Server Components: อ่านข้อมูลเริ่มต้น
  └─ Server Actions: ตรวจ session และสั่งงานที่มี side effect
          │
          ▼
Supabase Auth + Postgres
  ├─ RLS ทุกตาราง: จำกัดข้อมูลตามผู้ใช้และทีม
  ├─ RPC แบบ SECURITY DEFINER: สร้างทีม/เข้าทีมอย่าง atomic
  ├─ constraints และ trigger: รักษากติกาที่ policy อย่างเดียวไม่พอ
  └─ auth.users: ตัวตนและอีเมล

งานเสริม US-6:
Server Action ──หลังสร้าง task สำเร็จ──> Gmail SMTP
```

หลักการสำคัญ:

- UI ซ่อนสิ่งที่ผู้ใช้ทำไม่ได้เพื่อให้ใช้งานง่าย แต่ฐานข้อมูลต้องเป็นผู้บังคับสิทธิ์จริง (AC-2.4, AC-2.6, AC-3.3, AC-3.4, AC-3.7, AC-4.3, AC-4.4)
- Browser ใช้เฉพาะ `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ไม่มี service-role key (NFR-1, NFR-2)
- Server ตรวจตัวตนด้วย `supabase.auth.getUser()` หรือ `getClaims()` ไม่เชื่อ `user_id`, role หรืออีเมลจากฟอร์ม
- การสร้างทีมและเข้าทีมทำผ่าน RPC เพื่อให้ตรวจเงื่อนไขและเขียนหลายตารางสำเร็จหรือยกเลิกพร้อมกัน
- วันกำหนดส่งเก็บเป็น PostgreSQL `date` และตัดสินว่าเลยกำหนดด้วยวันที่ปัจจุบันในเขต `Asia/Bangkok` (AC-4.5)

## 2. แบบจำลองข้อมูล

### 2.1 Enum

`task_status`

- `todo` แสดงเป็น “ยังไม่เริ่ม”
- `doing` แสดงเป็น “กำลังทำ”
- `done` แสดงเป็น “เสร็จแล้ว”

ใช้ enum เพื่อปฏิเสธสถานะอื่นตั้งแต่ฐานข้อมูล (AC-4.1)

### 2.2 ตาราง `profiles`

| คอลัมน์ | ชนิด | กติกา |
|---|---|---|
| `id` | `uuid` | PK และ FK → `auth.users(id)` แบบ `on delete cascade` |
| `display_name` | `text` | `not null`, ตัดช่องว่างแล้วต้องไม่ว่าง |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()` |

เมื่อสมัครสมาชิก ส่ง `display_name` ใน Auth metadata และใช้ trigger หลังสร้าง `auth.users` เพื่อสร้าง profile ใน transaction เดียวกัน (AC-1.1) อีเมลไม่ทำซ้ำในตารางนี้; US-6 อ่านอีเมลของผู้รับจาก `auth.users` ผ่าน RPC ฝั่ง server ที่ตรวจว่าผู้เรียกเป็นหัวหน้าทีมและผู้รับอยู่ใน task ที่เพิ่งสร้าง ไม่เปิดอีเมลให้ browser query โดยตรง (AC-6.4)

### 2.3 ตาราง `teams`

| คอลัมน์ | ชนิด | กติกา |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `text` | `not null`, ตัดช่องว่างแล้วต้องไม่ว่าง |
| `invite_code` | `text` | `not null unique`, ตรงรูปแบบ `^[A-Z0-9]{6}$` |
| `owner_id` | `uuid` | `not null`, FK → `auth.users(id)` |
| `created_at` | `timestamptz` | `not null default now()` |

รหัสเชิญสุ่มจากตัวอักษรที่อ่านง่าย ความซ้ำถูกกันด้วย unique constraint และ RPC ลองสร้างใหม่เมื่อชนกัน (AC-2.2)

### 2.4 ตาราง `team_members`

| คอลัมน์ | ชนิด | กติกา |
|---|---|---|
| `user_id` | `uuid` | PK, FK → `auth.users(id)` แบบ `on delete cascade` |
| `team_id` | `uuid` | `not null`, FK → `teams(id)` แบบ `on delete cascade` |
| `joined_at` | `timestamptz` | `not null default now()` |

ใช้ `user_id` เป็น primary key จึงรับประกันว่าผู้ใช้หนึ่งคนอยู่ได้ไม่เกินหนึ่งทีม แม้ยิงคำขอพร้อมกัน (AC-2.4) บทบาทไม่เก็บซ้ำในตารางนี้: ผู้ใช้เป็นหัวหน้าเมื่อ `teams.owner_id = team_members.user_id` ลดโอกาสข้อมูลบทบาทขัดกัน

### 2.5 ตาราง `tasks`

| คอลัมน์ | ชนิด | กติกา |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `team_id` | `uuid` | `not null`, FK → `teams(id)` แบบ `on delete cascade` |
| `title` | `text` | `not null`, ตัดช่องว่างแล้วต้องไม่ว่าง |
| `description` | `text` | nullable |
| `due_date` | `date` | nullable |
| `assignee_id` | `uuid` | `not null`, FK → `auth.users(id)` |
| `status` | `task_status` | `not null default 'todo'` |
| `created_by` | `uuid` | `not null`, FK → `auth.users(id)` |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()` |

เพิ่ม composite foreign key `(team_id, assignee_id)` → `team_members(team_id, user_id)` โดยสร้าง unique index ที่คู่คอลัมน์ของ `team_members` ก่อน เพื่อห้ามมอบงานให้คนนอกทีมในระดับฐานข้อมูล (AC-3.4)

ดัชนีที่ต้องมี:

- `team_members(team_id)` สำหรับรายชื่อสมาชิก
- `tasks(team_id, status, created_at)` สำหรับบอร์ดงาน (AC-3.2)
- `tasks(assignee_id, due_date)` สำหรับ “งานของฉัน” (AC-5.1)

## 3. ฟังก์ชันฐานข้อมูลและกติกาความถูกต้อง

### 3.1 `create_team(team_name text)`

RPC แบบ `SECURITY DEFINER`, กำหนด `search_path` แบบคงที่ และ revoke สิทธิ์จาก `public` ก่อน grant ให้ `authenticated`

1. อ่านผู้ใช้จาก `auth.uid()` เท่านั้น
2. ตรวจชื่อหลัง trim; ถ้าว่างคืน error code ที่ UI แปลเป็น “กรุณากรอกชื่อทีม” (AC-2.5)
3. ตรวจว่าไม่มีแถว `team_members` ของผู้ใช้นี้ มิฉะนั้นคืน “คุณมีทีมอยู่แล้ว” (AC-2.4)
4. สร้าง `teams` พร้อม invite code ที่ไม่ซ้ำ
5. เพิ่มผู้สร้างใน `team_members`
6. คืนข้อมูลทีม ทั้งหมดอยู่ใน transaction เดียว (AC-2.2)

### 3.2 `join_team(invite_code text)`

RPC แบบ `SECURITY DEFINER` ที่ไม่เปิดให้ผู้ยังไม่มีทีมอ่านตาราง `teams`

1. อ่านผู้ใช้จาก `auth.uid()`
2. ตรวจว่าผู้ใช้ยังไม่มีทีม มิฉะนั้นคืน “คุณมีทีมอยู่แล้ว”
3. normalize รหัสเป็นตัวพิมพ์ใหญ่และค้นหาแบบ exact match
4. ถ้าไม่พบ คืน “ไม่พบทีมจากรหัสนี้”
5. insert `team_members`; unique constraint ป้องกัน race condition

RPC ไม่คืนข้อมูลทีมอื่นหรือรายการรหัสเชิญทั้งหมด (AC-2.3, AC-2.6)

### 3.3 Trigger ป้องกันการแก้เกินสิทธิ์ของสมาชิก

RLS `UPDATE` ตรวจสิทธิ์ที่แถวปลายทางได้ แต่ไม่เหมาะกับการยืนยันว่าเปลี่ยนเพียงคอลัมน์เดียว จึงใช้ `BEFORE UPDATE` trigger บน `tasks`:

- ถ้า `auth.uid()` เป็น owner ของทีม อนุญาตการแก้ task ในทีมนั้น
- ถ้าเป็นผู้รับงาน อนุญาตเฉพาะเมื่อค่าที่เปลี่ยนมีเพียง `status` (และ `updated_at` ที่ระบบตั้งให้)
- คนอื่นปฏิเสธ
- ห้ามเปลี่ยน `id`, `team_id`, `created_by`, `created_at` ทุกกรณี

กติกานี้ทำให้คำขอที่ข้าม UI ถูกปฏิเสธตาม AC-4.3 และ AC-4.4

### 3.4 การสร้างงาน

ใช้ Server Action รับเฉพาะ `title`, `description`, `due_date`, `assignee_id` จากฟอร์ม จากนั้น:

1. ตรวจผู้ใช้ด้วย Auth
2. trim และตรวจ title; ถ้าว่างแสดง “กรุณากรอกชื่องาน” (AC-3.5)
3. หา team และยืนยันว่าผู้ใช้เป็น owner
4. insert โดยกำหนด `team_id` และ `created_by` จากข้อมูลที่เชื่อถือได้ ไม่รับจากฟอร์ม
5. RLS และ composite FK ตรวจซ้ำว่าผู้สร้างเป็นหัวหน้าและผู้รับอยู่ทีมเดียวกัน (AC-3.3, AC-3.4)

## 4. นโยบาย RLS

เปิด RLS ทุกตารางและไม่สร้าง policy สำหรับ `anon` (NFR-1)

### ตารางสิทธิ์ (แบบสำหรับ RLS)

เครื่องหมาย `✓` หมายถึงอนุญาต, `–` หมายถึงปฏิเสธ และข้อความในช่อง update ระบุคอลัมน์ที่แก้ได้ บทบาท “หัวหน้า/สมาชิกทีม” หมายถึงทีมเดียวกับแถวนั้นเท่านั้น หากเป็นคนละทีมให้ถือเป็น “คนนอกทีม” เสมอ

| ตาราง | บทบาท | select | insert | update | delete | เงื่อนไข |
|---|---|---:|---:|---|---:|---|
| `profiles` | `anon` | – | – | – | – | ต้องล็อกอินก่อน |
| `profiles` | เจ้าของ profile | ✓ | – | `display_name` | – | `id = auth.uid()`; profile สร้างโดย auth trigger |
| `profiles` | หัวหน้าทีมเดียวกัน | ✓ | – | – | – | มี `team_id` เดียวกัน |
| `profiles` | สมาชิกทีมเดียวกัน | ✓ | – | – | – | มี `team_id` เดียวกัน |
| `profiles` | คนนอกทีม | – | – | – | – | ป้องกันชื่อสมาชิกข้ามทีม (AC-2.6) |
| `teams` | `anon` | – | – | – | – | ต้องล็อกอินก่อน |
| `teams` | หัวหน้าทีม | ✓ | ผ่าน RPC | – | – | `owner_id = auth.uid()`; MVP ไม่แก้/ลบทีม |
| `teams` | สมาชิกทีม | ✓ | ผ่าน RPC | – | – | มีแถว `team_members` ของทีมนั้น |
| `teams` | ผู้ล็อกอินที่ยังไม่มีทีม | – | ผ่าน RPC | – | – | RPC สร้าง/ค้นรหัสโดยไม่เปิดตาราง |
| `teams` | คนนอกทีม | – | – | – | – | ป้องกันชื่อและรหัสเชิญข้ามทีม (AC-2.6) |
| `team_members` | `anon` | – | – | – | – | ต้องล็อกอินก่อน |
| `team_members` | หัวหน้าทีม | ✓ | ผ่าน RPC | – | – | อ่านสมาชิกทีมตัวเอง; MVP ไม่เตะสมาชิก |
| `team_members` | สมาชิกทีม | ✓ | ผ่าน RPC | – | – | อ่านสมาชิกทีมตัวเอง; join ผ่าน RPC |
| `team_members` | ผู้ล็อกอินที่ยังไม่มีทีม | – | ผ่าน RPC | – | – | join ผ่านรหัสเชิญเท่านั้น |
| `team_members` | คนนอกทีม | – | – | – | – | ป้องกันรายชื่อสมาชิกข้ามทีม (AC-2.6) |
| `tasks` | `anon` | – | – | – | – | ต้องล็อกอินก่อน |
| `tasks` | หัวหน้าทีม | ✓ | ✓ | `status` และข้อมูลงาน* | – | `team_id` เป็นทีมที่ตนเป็น owner; MVP ยังไม่มี UI แก้ข้อมูลงาน |
| `tasks` | สมาชิกที่เป็นผู้รับงาน | ✓ | – | `status` เท่านั้น | – | `assignee_id = auth.uid()` (AC-4.1, AC-4.4) |
| `tasks` | สมาชิกทีมที่ไม่ใช่ผู้รับ | ✓ | – | – | – | เห็นความคืบหน้าทีม แต่แก้ไม่ได้ (AC-4.3) |
| `tasks` | คนนอกทีม | – | – | – | – | ป้องกันงานข้ามทีม (AC-3.7) |

\* ข้อกำหนดให้หัวหน้าเปลี่ยนสถานะทุกงานได้ (AC-4.2) และระบุว่าผู้รับที่ไม่ใช่หัวหน้าเท่านั้นที่ถูกจำกัดให้แก้เฉพาะสถานะ (AC-4.4) จึงออกแบบฐานข้อมูลให้หัวหน้าแก้ข้อมูลงานได้ แต่ MVP ไม่สร้างหน้าจอแก้ไขหรือลบงานตาม `plan.md`

### `profiles`

- `SELECT`: อ่าน profile ตัวเอง หรือ profile ของผู้ที่มี `team_id` เดียวกับผู้ใช้ปัจจุบัน
- `UPDATE`: แก้ profile ของตัวเองเท่านั้น และจำกัดคอลัมน์ที่ grant ให้แก้เฉพาะ `display_name`, `updated_at`
- `INSERT/DELETE`: ไม่มีสิทธิ์ตรงจาก browser; profile สร้างด้วย auth trigger

ผลคือทีมเดียวกันเห็นชื่อสมาชิก แต่คนนอกทีม query profile ไม่ได้ (AC-2.6)

### `teams`

- `SELECT`: อ่านได้เมื่อมี `team_members` ที่ `user_id = auth.uid()` และ `team_id = teams.id`
- ไม่มี `INSERT/UPDATE/DELETE` ตรงจาก browser; การสร้างใช้ RPC

ผลคือผู้ยังไม่มีทีมไม่สามารถค้น invite code และคนนอกไม่เห็นชื่อหรือรหัสทีม (AC-2.6)

### `team_members`

- `SELECT`: อ่านได้เฉพาะสมาชิกของทีมเดียวกับผู้ใช้ปัจจุบัน
- ไม่มี `INSERT/UPDATE/DELETE` ตรงจาก browser; เพิ่มสมาชิกผ่าน RPC

policy ใช้ helper function ที่ปลอดภัยและไม่ทำให้เกิด RLS recursion เช่น `current_team_id()` ซึ่งคืน team ของ `auth.uid()` เท่านั้น

### `tasks`

- `SELECT`: อ่านได้เมื่อ `tasks.team_id = current_team_id()` (AC-3.7)
- `INSERT`: ผู้ใช้ต้องเป็น `teams.owner_id`, `created_by = auth.uid()`, `team_id` เป็นทีมของตน และ assignee เป็นสมาชิกทีมนั้น (AC-3.3, AC-3.4)
- `UPDATE`: owner ของทีมนั้น หรือ `assignee_id = auth.uid()`; trigger ตรวจคอลัมน์ที่เปลี่ยนอีกชั้น (AC-4.1 ถึง AC-4.4)
- `DELETE`: ไม่มี policy เพราะ MVP ไม่ลบงานผ่านเว็บ

helper function ทุกตัวใช้ `SECURITY DEFINER` เท่าที่จำเป็น, ตั้ง `search_path`, ไม่รับ user id จาก client และคืนข้อมูลน้อยที่สุด

## 5. โครงสร้างหน้าและการไหลของผู้ใช้

### เส้นทาง

| Route | หน้าที่ | การป้องกัน |
|---|---|---|
| `/login` | สมัครสมาชิกและล็อกอิน | ผู้ล็อกอินแล้วไป `/team` |
| `/team` | สร้าง/เข้าทีม หรือดูข้อมูลทีมและสมาชิก | ต้องล็อกอิน |
| `/tasks` | บอร์ดงาน 3 สถานะและฟอร์มสร้างงานของหัวหน้า | ต้องล็อกอิน; ไม่มีทีมไป `/team` |
| `/my` | งานที่ฉันได้รับ (US-5) | ต้องล็อกอิน; ไม่มีทีมไป `/team` |

`proxy.ts` refresh session และ redirect ผู้ที่ยังไม่ล็อกอินจาก `/team`, `/tasks`, `/my` ไป `/login` (AC-1.4, AC-1.5) แต่ทุก Server Action ยังตรวจ Auth ซ้ำ เพราะ proxy ไม่ใช่ขอบเขตความปลอดภัย

### `/login` — US-1

- มีโหมดสมัคร: ชื่อที่แสดง, อีเมล, รหัสผ่านอย่างน้อย 6 ตัว และปุ่มสมัคร (AC-1.1)
- มีโหมดล็อกอิน: อีเมลและรหัสผ่าน
- map ข้อผิดพลาด credential เป็น “อีเมลหรือรหัสผ่านไม่ถูกต้อง” โดยไม่เผยว่ามีอีเมลนี้หรือไม่ (AC-1.2)
- หลังสำเร็จ redirect `/team` และ refresh router
- Header ของหน้าที่ล็อกอินแสดง `display_name` และปุ่มออกจากระบบ; sign out แล้วไป `/login` (AC-1.3)

### `/team` — US-2

- ถ้ายังไม่มีทีม แสดงการ์ด “สร้างทีม” และ “เข้าร่วมทีม” พร้อม validation ภาษาไทย (AC-2.1, AC-2.5)
- ถ้ามีทีม แสดงชื่อทีม, invite code 6 ตัว, ปุ่มคัดลอก และสมาชิกพร้อมป้าย “หัวหน้า/สมาชิก” (AC-2.2, AC-2.3)
- หลัง RPC สำเร็จ revalidate ข้อมูลและแสดงหน้าทีมทันที

### `/tasks` — US-3 และ US-4

- หัวหน้าเห็นฟอร์มสร้างงาน; สมาชิกไม่เห็น (AC-3.1, AC-3.3)
- ตัวเลือกผู้รับมาจาก query สมาชิกทีม ไม่รับรายชื่ออิสระ
- บอร์ดแบ่ง `todo`, `doing`, `done`; card แสดงชื่อ ผู้รับ และ due date ภาษาไทย (AC-3.2)
- ผู้รับหรือหัวหน้าเห็นตัวเลือกเปลี่ยนสถานะ; คนอื่นเห็นค่าแบบอ่านอย่างเดียว (AC-4.1 ถึง AC-4.3)
- หลังเปลี่ยนสถานะสำเร็จ ใช้ optimistic UI ได้ แต่ต้อง rollback และแสดง error หากฐานข้อมูลปฏิเสธ
- แสดงป้าย “เลยกำหนด” เมื่อ `due_date < วันที่วันนี้ใน Asia/Bangkok` และ status ไม่ใช่ `done` (AC-4.5)
- ถ้าไม่มีงาน แสดง “ยังไม่มีงานในทีม” (AC-3.6)

### `/my` — US-5 (งานเสริม)

- query เฉพาะ `assignee_id = auth.uid()` และ RLS ยังคงบังคับทีม
- เรียง `due_date asc nulls last`; ซ่อน `done` เริ่มต้น (AC-5.1, AC-5.2)
- empty state แสดง “ยังไม่มีงานที่ได้รับมอบหมาย” และลิงก์ `/tasks` (AC-5.3)
- component เปลี่ยนสถานะใช้ action เดียวกับ `/tasks` (AC-5.4)

## 6. รูปแบบ Server Actions และข้อผิดพลาด

ทุก action คืนผลรูปแบบเดียวกัน:

```ts
type ActionResult<T = undefined> =
  | { ok: true; data: T; warning?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
```

- ข้อความต่อผู้ใช้เป็นภาษาไทยและไม่แสดง SQL, stack trace หรือข้อมูลลับ
- error ที่คาดหมายถูก map เป็นข้อความตาม AC แบบตรงตัว
- error ที่ไม่คาดหมาย log เฉพาะฝั่ง server แล้วแสดง “เกิดข้อผิดพลาด กรุณาลองใหม่”
- ปุ่ม submit ปิดชั่วคราวระหว่างส่งและแสดง “กำลังบันทึก…” เพื่อกันการกดซ้ำ

## 7. อีเมลแจ้งงาน — US-6 (งานเสริม)

หลัง insert task สำเร็จแล้วเท่านั้น Server Action จึง:

1. เรียก RPC แบบ `SECURITY DEFINER` จาก Server Action โดยส่ง `task_id` ที่สร้างแล้ว RPC ตรวจ `auth.uid()` ว่าเป็นผู้สร้าง/หัวหน้าของ task และคืนอีเมลจาก `auth.users` ของ `tasks.assignee_id`; ไม่รับ `to` หรืออีเมลจาก request และไม่เปิด RPC นี้ให้ `anon` (AC-6.2, AC-6.4)
2. อ่านชื่อผู้รับ ชื่อทีม และชื่อผู้มอบหมายจากฐานข้อมูล
3. ส่งผ่าน Nodemailer/Gmail SMTP ด้วย `GMAIL_USER` และ `GMAIL_APP_PASSWORD` ที่มีเฉพาะ server (AC-6.5)
4. ใช้หัวเรื่อง `งานใหม่: <ชื่องาน>` และเนื้อหาตาม AC-6.1
5. ถ้าส่งล้มเหลว ไม่ rollback task และคืน warning “สร้างงานแล้ว แต่ส่งอีเมลแจ้งไม่สำเร็จ” (AC-6.3)

การส่งแบบ synchronous หลัง insert เหมาะกับ workshop และควรตั้ง timeout ให้เสร็จภายใน 1 นาที หากนำไปใช้จริงควรเปลี่ยนเป็น transactional outbox และ worker เพื่อ retry โดยไม่ส่งซ้ำ

## 8. สถานะหน้าจอและ Responsive Design

ทุกหน้าและทุกส่วนข้อมูลมี 4 สถานะ: กำลังโหลด, มีข้อมูล, ไม่มีข้อมูล, ผิดพลาด พร้อมข้อความภาษาไทย (NFR-3)

- ใช้ `loading.tsx` หรือ skeleton สำหรับการเปลี่ยน route
- ใช้ empty state เฉพาะบริบท เช่น “ยังไม่มีงานในทีม”
- error ที่ retry ได้มีปุ่ม “ลองใหม่”
- ที่ความกว้าง 375px ไม่มี horizontal overflow; ฟอร์มและปุ่มกว้างเต็มพื้นที่ตามเหมาะสม
- บอร์ด `/tasks` ใช้ 1 คอลัมน์บนจอแคบ และ 3 คอลัมน์ตั้งแต่ breakpoint ที่พื้นที่พอ (NFR-4)
- control มี label ชัดเจน, focus state, keyboard navigation และสีป้ายไม่เป็นช่องทางสื่อความหมายเพียงอย่างเดียว

## 9. โครงสร้างไฟล์ที่เสนอ

```text
app/
  layout.tsx
  login/page.tsx
  team/page.tsx
  tasks/page.tsx
  my/page.tsx
  loading.tsx
  actions/
    auth.ts
    teams.ts
    tasks.ts
components/
  app-header.tsx
  auth-form.tsx
  team-panel.tsx
  task-form.tsx
  task-board.tsx
  task-card.tsx
lib/
  supabase/client.ts
  supabase/server.ts
  auth.ts
  dates.ts
  mail.ts                 # server-only, US-6
proxy.ts
supabase/migrations/
  <timestamp>_team_tracker_schema.sql
```

Server Component เป็นผู้โหลดข้อมูลเริ่มต้น ส่วน Client Component ใช้เฉพาะบริเวณที่ต้องโต้ตอบ เพื่อลด JavaScript ฝั่ง browser และรักษาการตรวจสิทธิ์ไว้ฝั่ง server/ฐานข้อมูล

## 10. แผนทดสอบและการตรวจรับ

### Automated checks

- Unit: แปลง `task_status`, รูปแบบวันที่ไทย, เงื่อนไขเลยกำหนดโดยยึด Asia/Bangkok
- Integration ฐานข้อมูล: constraints, RPC และ RLS ด้วยบัญชี A/B/C
- Action tests: validation ภาษาไทย, Auth ที่หายไป, การ map error และ email failure
- UI: mobile 375px, empty/loading/error states และการมองเห็น control ตาม role

### Traceability

| ข้อกำหนด | จุดออกแบบ | การทดสอบหลัก |
|---|---|---|
| US-1 / AC-1.1–1.5 | Auth metadata + profile trigger, proxy, header | สมัคร/ล็อกอินผิด/คง session/redirect/ออกระบบ |
| US-2 / AC-2.1–2.6 | `teams`, `team_members`, RPC, RLS | A สร้าง, B เข้า, รหัสผิด, สมัครซ้ำ, C query ไม่เห็น |
| US-3 / AC-3.1–3.7 | `tasks`, owner insert policy, composite FK, RLS | A สร้างให้ B, B สร้างไม่ได้, มอบให้ C ไม่ได้, C ไม่เห็นงาน |
| US-4 / AC-4.1–4.5 | update policy + column-guard trigger | B แก้ status ตน, A แก้ทุกงาน, B แก้งานคนอื่น/field อื่นไม่ได้, overdue |
| US-5 / AC-5.1–5.4 | `/my`, assignee filter, sort/filter | แสดงเฉพาะของตน, null due ท้ายสุด, toggle done, empty state |
| US-6 / AC-6.1–6.5 | server-only mail หลัง insert | อีเมลถูกคน/เนื้อหาถูก, insert fail ไม่ส่ง, SMTP fail ไม่ลบ task |
| NFR-1–2 | RLS ทุกตาราง, publishable key, env | ตรวจ grants/policies และ secret scan |
| NFR-3–4 | state design, responsive layout | ตรวจทุก route และ viewport 375px |

การทดสอบสิทธิ์ต้องยิง query/API โดยตรงด้วย publishable key ไม่พึ่งเฉพาะการตรวจว่าปุ่มถูกซ่อน เพราะ AC-2.4, AC-2.6, AC-3.3, AC-3.4, AC-3.7, AC-4.3 และ AC-4.4 กำหนดให้ระบบปฏิเสธคำขอที่ข้ามหน้าจอด้วย

## 11. ลำดับการพัฒนา

1. Migration: enum, tables, constraints, indexes, triggers, RPC และ RLS
2. US-1: สมัคร/ล็อกอิน/session/header และตรวจ AC-1.1–1.5
3. US-2: สร้าง/เข้าทีม/รายชื่อสมาชิก และตรวจ isolation ด้วย A/B/C
4. US-3: สร้างงาน/บอร์ด/empty state และทดสอบคำขอข้ามสิทธิ์
5. US-4: เปลี่ยนสถานะ/trigger ป้องกัน field อื่น/ป้ายเลยกำหนด
6. ตรวจ NFR-1–4, lint, build และ deploy MVP
7. ถ้ามีเวลา ทำ US-5 แล้ว US-6 ตามลำดับ

## 12. การตัดสินใจและข้อที่ไม่ทำ

- ไม่รองรับแก้ไขหรือลบงานผ่าน UI ตามขอบเขต MVP
- ไม่รองรับหลายทีม, ออกจากทีม, เปลี่ยนหัวหน้า หรือเตะสมาชิก จึงไม่ออกแบบ policy สำหรับการทำเหล่านี้
- ไม่ใช้ service-role key ในแอป; การยกระดับที่จำเป็นจำกัดอยู่ใน RPC ที่ตรวจ `auth.uid()` และสิทธิ์เฉพาะงาน
- ไม่เก็บ role ซ้ำใน `team_members`; owner ของ `teams` คือแหล่งจริงเพียงจุดเดียว
- ไม่คำนวณ “เลยกำหนด” จากเวลาของเครื่องผู้ใช้โดยตรง แต่ใช้วันที่ Asia/Bangkok เพื่อให้ผลตรงกันทุกเครื่อง
- US-5 และ US-6 ต้องไม่ทำให้ US-1 ถึง US-4 หรือ security boundary อ่อนลง
