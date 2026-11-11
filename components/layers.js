// Layers of the Berry Swirl Parfait, top to bottom (same order as the exploded view in the guide).
// `group` is the node name in /public/models/parfait.glb.
// `lift` is how far (metres) the layer rises when the cup is opened; `delay` staggers the motion.
export const LAYERS = [
  {
    key: 'cherry', group: 'G_Cherry', lift: 0.42, delay: 0.0,
    name: 'حبة الكرز',
    text: 'كرزة لامعة بعنقها تتوّج الكوب، حلاوتها فيها لمسة حموضة.',
  },
  {
    key: 'cream', group: 'G_Cream', lift: 0.36, delay: 0.05,
    name: 'كريمة مخفوقة',
    text: 'كريمة خفيفة مزيّنة بفوهة النجمة، طرية وباردة.',
  },
  {
    key: 'crumbleTop', group: 'G_CrumbleTop', lift: 0.285, delay: 0.1,
    name: 'قطع الكرامبل',
    text: 'فتات بسكويت محمّص بالزبدة يضيف القرمشة فوق الكريمة.',
  },
  {
    key: 'berry', group: 'G_Berry', lift: 0.315, delay: 0.15,
    name: 'كومبوت التوت',
    text: 'توت مطبوخ على نار هادئة، كثيف ولامع، يلتف بين الطبقات.',
  },
  {
    key: 'vanilla', group: 'G_Vanilla', lift: 0.265, delay: 0.2,
    name: 'آيس كريم الفانيلا',
    text: 'آيس كريم فانيلا كريمي، قلب البارفيه.',
  },
  {
    key: 'crumbleMid', group: 'G_CrumbleMid', lift: 0.235, delay: 0.25,
    name: 'كرامبل القاعدة',
    text: 'طبقة مقرمشة في الأسفل حتى تبقى كل ملعقة متوازنة.',
  },
  {
    key: 'cup', group: 'G_Cup', lift: 0, delay: 0.3,
    name: 'الكوب',
    text: 'كوب شفاف بطول ١٨٥ ملم يُظهر الطبقات ويحمل شعار منز.',
  },
];
