const crypto = require('crypto');

/**
 * Telegram WebApp initData ni server tomondan tekshirish.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param {string} initData - tg.initData (URL-encoded query string)
 * @param {string} botToken
 * @param {number} maxAgeSec - auth_date eskirish chegarasi (default 24h)
 * @returns {{ ok:true, user:object, authDate:number, startParam?:string } | { ok:false, error:string }}
 */
function verifyInitData(initData, botToken, maxAgeSec = 86400) {
  if (!initData || typeof initData !== 'string') return { ok:false, error:'no initData' };
  if (!botToken)                                   return { ok:false, error:'BOT_TOKEN missing' };

  const params = new URLSearchParams(initData);
  const hash   = params.get('hash');
  if (!hash) return { ok:false, error:'hash missing' };

  // hash dan tashqari barcha parametrlarni alfavit tartibda key=value\n bilan birlashtirish
  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k !== 'hash') pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed  = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) return { ok:false, error:'invalid signature' };

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const ageSec   = Math.floor(Date.now() / 1000) - authDate;
  if (!authDate || ageSec > maxAgeSec) return { ok:false, error:'expired' };

  let user = null;
  const userJson = params.get('user');
  if (userJson) {
    try { user = JSON.parse(userJson); } catch { return { ok:false, error:'invalid user json' }; }
  }
  if (!user || !user.id) return { ok:false, error:'no user' };

  return {
    ok: true,
    user,
    authDate,
    startParam: params.get('start_param') || null,
  };
}

module.exports = { verifyInitData };
