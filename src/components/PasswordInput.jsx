import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Input password + tombol mata. Default tersembunyi; tiap instance punya toggle sendiri.
// `iconClass` untuk latar gelap (login). Sisa prop diteruskan ke <input>.
/** @param {import('react').InputHTMLAttributes<HTMLInputElement> & { iconClass?: string }} props */
export default function PasswordInput({ className = '', iconClass = 'text-slate-400 hover:text-slate-600', ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...rest} type={show ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-pressed={show}
        className={`absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-1 ${iconClass}`}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
