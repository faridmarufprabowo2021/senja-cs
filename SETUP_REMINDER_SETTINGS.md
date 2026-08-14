# Reminder Settings Booking H-1 - COMPLETE SETUP GUIDE
# ==========================================
# Jalankan langkah-langkah berikut SETELAH Docker PostgreSQL running

# STEP 1: Push Prisma Schema ke Database
# ----------------------------------------
cd apps/api
pnpm db:push

# Jika pnpm db:push error karena DB down, gunakan manual SQL:
# -----------------------------------------------------------
# Buka terminal PowerShell dan jalankan:
# 
# $env:PGPASSWORD = "cs_secret"
# & C:\Program Files\PostgreSQL\17\bin\psql.exe -h localhost -p 5434 -U cs -d customer_service -f migrations/add_reminder_settings.sql
#
# (Sesuaikan path psql.exe dengan versi PostgreSQL Anda)

# STEP 2: Generate Prisma Types
# ------------------------------
pnpm db:generate

# STEP 3: Verify Database Columns Added
# ---------------------------------------
# Run this to verify columns exist:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'botsettings' 
AND column_name IN ('reminderenabled', 'remindervindowstarthours', 'remindervwindowendhours', 'remindertemplate');

# Expected result: 4 rows (reminderEnabled, reminderWindowStartHours, reminderWindowEndHours, reminderTemplate)

# STEP 4: Restart API Server
# ---------------------------
# Pergi ke folder API dan restart server:
cd ../../..
pnpm --filter @cs/api dev

# STEP 5: Test API Endpoints
# ---------------------------
# Open new terminal dan test endpoints:

# Get current settings (should return default values):
curl http://localhost:4000/api/v1/reminder-settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Tenant-Id: YOUR_TENANT_ID"

# Update settings with custom values:
curl -X PATCH http://localhost:4000/api/v1/reminder-settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Tenant-Id: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "reminderEnabled": true,
    "reminderWindowStartHours": 36,
    "reminderWindowEndHours": 24,
    "reminderTemplate": "Hi {name}, reminder for {service} on {date} tomorrow!"
  }'

# STEP 6: Test Reminder Scheduler
# --------------------------------
# Setelah update settings, scheduler otomatis akan run setiap 15 menit
# Log output akan muncul di console API server:
# [Scheduler] Starting automated booking/order reminder scheduler...
# [Scheduler] Hourly run: X booking reminders sent, Y order followups sent

# STEP 7: Verify UI Works
# ------------------------
# Buka browser ke: http://localhost:3001/settings
# Scroll ke section "Reminder Booking H-1"
# Toggle enable/disable dan edit template/preset

# SUCCESS CHECKLIST:
# ===================
# ✅ Database columns added (reminderEnabled, reminderWindowStartHours, etc.)
# ✅ Prisma types generated successfully
# ✅ API endpoint accessible: GET/PATCH /api/v1/reminder-settings
# ✅ UI section visible at /settings page
# ✅ Scheduler running in background (check logs)
# ✅ Can toggle enable/disable from UI
# ✅ Can customize window hours and template

# TROUBLESHOOTING:
# =================
# Error: "Cannot reach database server" → Start Docker Desktop first
# Error: "column does not exist" → Run manual SQL migration script
# Error: TypeCheck errors after push → Run `pnpm db:generate` to regenerate types
# Settings not saving → Check JWT token is valid and has tenant permission
