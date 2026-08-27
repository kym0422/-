const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseConfig() {
  if (!url || !publishableKey) {
    throw new Error(
      "서비스 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.",
    );
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  return Boolean(url && publishableKey);
}
