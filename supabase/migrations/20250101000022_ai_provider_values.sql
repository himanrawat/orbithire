-- Allow every provider the app's registry offers (lib/ai/providers/registry.ts).
-- The original check only allowed openai/groq/custom, so saving an Anthropic or
-- Gemini key failed.
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_ai_provider_check;
ALTER TABLE user_settings ADD CONSTRAINT user_settings_ai_provider_check
  CHECK (ai_provider IN ('openai', 'groq', 'anthropic', 'gemini', 'custom'));
