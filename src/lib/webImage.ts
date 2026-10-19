// iPhone photos are often HEIC, which Chrome, Edge and Android can't display. Convert them to JPEG before upload,
// so every picture on TapIN works in every browser. The converter only loads when a HEIC photo is chosen.
const isHeic = (f: File) => /^image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

export async function webSafeImage(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.86 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    console.error('HEIC conversion failed', e);
    throw new Error('That photo format (HEIC) couldn\u2019t be converted. Please choose a JPG or PNG, or change your iPhone camera setting to "Most Compatible".');
  }
}
