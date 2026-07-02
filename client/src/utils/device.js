// Qurilma sichqonchani (hover) qo'llab-quvvatlaydimi.
// Mobil touch qurilmalarda `false` — hover effektlari, ovozlari va animatsiyalari
// o'chiriladi (tap `mouseenter`+`click` ni birga tetiklab ovozni 2 marta chaladi
// va hover holati yopishib qoladi).
export const CAN_HOVER =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(hover: hover)').matches
    : false;
