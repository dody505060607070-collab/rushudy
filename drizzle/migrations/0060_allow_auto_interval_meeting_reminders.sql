ALTER TABLE public.meeting_reminders DROP CONSTRAINT meeting_reminders_interval_hours_check;
ALTER TABLE public.meeting_reminders ADD CONSTRAINT meeting_reminders_interval_hours_check CHECK (interval_hours BETWEEN 0 AND 168);
COMMENT ON COLUMN public.meeting_reminders.interval_hours IS '0 = adaptive auto mode (increases as the meeting approaches); 1-168 = fixed hours between reminders';