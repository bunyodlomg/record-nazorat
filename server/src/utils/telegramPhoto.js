/**
 * Telegram foydalanuvchining profil rasmini olish.
 *
 * Telegram bot updates (`ctx.from`) tarkibida photo_url *yo'q* — uni faqat
 * `getUserProfilePhotos` + `getFile` orqali olamiz. Qaytariladigan URL botning
 * tokenini o'z ichiga oladi, shu bois faqat ichki ishlatish uchun. URL Telegram
 * tomonidan vaqt o'tishi bilan yangilanishi mumkin, biroq odatda uzoq amal qiladi.
 *
 * @param {import('telegraf').Telegram} telegram — bot.telegram yoki ctx.telegram
 * @param {string|number} userId — Telegram user ID
 * @returns {Promise<string|null>} to'liq URL yoki null
 */
async function fetchTelegramPhotoUrl(telegram, userId) {
  if (!telegram || !userId) return null;
  const token = process.env.BOT_TOKEN;
  if (!token) return null;

  try {
    const photos = await telegram.getUserProfilePhotos(Number(userId), 0, 1);
    if (!photos?.total_count || !photos.photos?.length) return null;

    // Eng katta o'lcham — array oxiri
    const sizes = photos.photos[0];
    const largest = sizes[sizes.length - 1];
    if (!largest?.file_id) return null;

    const file = await telegram.getFile(largest.file_id);
    if (!file?.file_path) return null;

    return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  } catch (err) {
    // Privacy settings (forbidden) yoki rasm yo'q — silent fallback
    return null;
  }
}

module.exports = { fetchTelegramPhotoUrl };
