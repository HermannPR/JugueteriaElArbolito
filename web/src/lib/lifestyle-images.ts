// Lifestyle / store photos (kids as models) stored in the Supabase `lifestyle` bucket.
// Used by the home hero carousel and the /nosotros gallery.
const BASE =
  "https://nigxlspxlurdxvwnlffu.supabase.co/storage/v1/object/public/lifestyle";

const FILES = [
  "dsc07801", "dsc07808", "dsc07815", "dsc07821", "dsc07827",
  "dsc07833", "dsc07838", "dsc07844", "dsc07849", "dsc07853",
  "dsc07868", "dsc07872", "dsc07934-2", "dsc07956", "dsc07957",
  "dsc07962", "dsc07966", "dsc07971", "dsc07977", "dsc07982",
  "dsc07989", "dsc07992", "dsc08002", "dsc08006", "dsc08015",
  "dsc08021", "dsc08023", "dsc08027", "dsc08028", "dsc08031",
];

export const lifestyleImages: string[] = FILES.map((f) => `${BASE}/${f}.webp`);
