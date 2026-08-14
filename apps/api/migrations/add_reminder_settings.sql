-- Manual Migration for Reminder Settings Booking H-1
-- Run this after ensuring PostgreSQL is running on localhost:5434

ALTER TABLE "BotSettings" 
ADD COLUMN IF NOT EXISTS "reminderEnabled" BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "reminderWindowStartHours" INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS "reminderWindowEndHours" INTEGER DEFAULT 18,
ADD COLUMN IF NOT EXISTS "reminderTemplate" TEXT DEFAULT '⏰ *Pengingat Jadwal Reservasi*\n\nHalo *{name}*,\nSekadar mengingatkan jadwal reservasi *{service}* Anda pada *{date}* besok.\n\n📌 *Catatan*: Mohon hadir 15 menit sebelum jam tindakan.\nJika ada perubahan jadwal, silakan balas chat ini ya. Terima kasih! 🙏';

-- Verify columns added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'botsettings' 
AND column_name IN ('reminderenabled', 'remindervindowstarthours', 'remindervwindowendhours', 'remindertemplate');
