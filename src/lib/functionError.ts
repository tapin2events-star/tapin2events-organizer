// Supabase wraps a failed edge function call in a generic error; the useful,
// human-readable message is in the response body. Returns { message, code }.
export async function functionError(error: unknown, fallback = 'Something went wrong. Please try again.'): Promise<{ message: string; code?: string }> {
  try {
    const body = await (error as { context?: Response }).context?.json();
    if (body?.error) return { message: String(body.error), code: body.code };
  } catch { /* fall through */ }
  return { message: fallback };
}
