// src/lib/line-notify.ts

export async function sendLineNotify(token: string, message: string): Promise<boolean> {
  try {
    const params = new URLSearchParams();
    params.append('message', message);

    const res = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`
      },
      body: params.toString()
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[line-notify] API error:', res.status, text);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[line-notify] Network error:', err.message);
    return false;
  }
}
