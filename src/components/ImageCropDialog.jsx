import { useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Loader2, Crop, X } from 'lucide-react';

const RATIOS = [['Bebas', undefined], ['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9]];
const FREE = { unit: '%', x: 5, y: 5, width: 90, height: 90 };

/**
 * Crop gambar di browser, hasilnya diunggah sebagai file baru (gambar asli di storage tidak berubah).
 * @param {{ src: string, onCancel: () => void, onDone: (file: File) => Promise<void> }} props
 */
export default function ImageCropDialog({ src, onCancel, onDone }) {
  const ref = useRef(null);
  const imgRef = useRef(null);
  const [crop, setCrop] = useState(FREE);
  const [done, setDone] = useState(null); // crop dalam piksel layar
  const [aspect, setAspect] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const pickRatio = (a) => {
    setAspect(a);
    const img = imgRef.current;
    if (!img) return;
    const next = a ? centerCrop(makeAspectCrop({ unit: '%', width: 90 }, a, img.width, img.height), img.width, img.height) : FREE;
    setCrop(next);
    setDone(null);
  };

  const apply = async () => {
    const img = imgRef.current;
    const c = done ?? (img && { unit: 'px', x: (crop.x / 100) * img.width, y: (crop.y / 100) * img.height, width: (crop.width / 100) * img.width, height: (crop.height / 100) * img.height });
    if (!img || !c || c.width < 8 || c.height < 8) return setError('Pilih area yang lebih besar.');
    setBusy(true);
    setError('');
    try {
      const sx = img.naturalWidth / img.width;
      const sy = img.naturalHeight / img.height;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(c.width * sx);
      canvas.height = Math.round(c.height * sy);
      canvas.getContext('2d').drawImage(img, c.x * sx, c.y * sy, c.width * sx, c.height * sy, 0, 0, canvas.width, canvas.height);
      const jpeg = /\.jpe?g(\?|$)/i.test(src);
      const type = jpeg ? 'image/jpeg' : 'image/png';
      const blob = await new Promise((res) => canvas.toBlob(res, type, 0.92));
      if (!blob) throw new Error('Gagal membuat gambar');
      await onDone(new File([blob], `crop.${jpeg ? 'jpg' : 'png'}`, { type }));
    } catch (e) {
      // SecurityError = storage tidak mengirim header CORS (canvas tercemar).
      setError(e.name === 'SecurityError' ? 'Gambar tidak bisa diproses di browser (CORS storage). Gunakan Replace.' : e.message);
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="crop-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
      className="m-auto w-[min(94vw,48rem)] bg-transparent p-0 backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
    >
      <div className="cd-pop overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 id="crop-title" className="flex items-center gap-2 text-base font-bold"><Crop size={18} className="text-brand-1" /> Crop gambar</h2>
          <button type="button" aria-label="Tutup" disabled={busy} onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={16} /></button>
        </div>

        <div className="flex flex-wrap gap-1.5 px-5 pt-3.5" role="group" aria-label="Rasio">
          {RATIOS.map(([name, a]) => (
            <button key={name} type="button" aria-pressed={aspect === a} onClick={() => pickRatio(a)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${aspect === a ? 'bg-brand-1 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{name}</button>
          ))}
        </div>

        <div className="grid max-h-[62vh] place-items-center overflow-auto bg-slate-100 p-4 mt-3.5">
          <ReactCrop crop={crop} aspect={aspect} onChange={(_, pct) => setCrop(pct)} onComplete={(px) => setDone(px)} keepSelection>
            {/* crossOrigin: tanpa ini canvas tercemar dan toBlob gagal */}
            <img ref={imgRef} src={src} alt="Gambar yang di-crop" crossOrigin="anonymous" style={{ maxHeight: '56vh' }}
              onError={() => setError('Gambar tidak bisa dimuat untuk di-crop (kemungkinan CORS storage). Gunakan Replace.')} />
          </ReactCrop>
        </div>

        {error && <p role="alert" className="mx-5 mt-3 rounded-xl bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}

        <div className="grid grid-cols-2 gap-3 p-5">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
          <button type="button" disabled={busy} onClick={apply}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-1 to-brand-2 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-1/30 hover:brightness-110 disabled:opacity-70">
            {busy && <Loader2 size={16} className="animate-spin" />} Terapkan crop
          </button>
        </div>
      </div>
    </dialog>
  );
}
