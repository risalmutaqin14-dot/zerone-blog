import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, Heading2, Heading3, Heading4, Pilcrow,
  List, ListOrdered, Quote, Code, SquareCode, Link2, Link2Off, ImagePlus, Minus, Eraser,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo2, Redo2,
} from 'lucide-react';

const Sep = () => <span className="mx-1 h-5 w-px bg-slate-300" />;

function Btn({ title, active, disabled, onClick, children }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={!!active} disabled={disabled} onClick={onClick}
      className={`rounded-lg p-2 transition disabled:opacity-30 ${active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>
      {children}
    </button>
  );
}

export default function RichEditor({ value, onChange, onUploadImage }) {
  const editor = useEditor({
    // Astro SSR: hindari hydration mismatch.
    immediatelyRender: false,
    extensions: [
      // StarterKit v3 sudah memuat Link & Underline.
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true } }),
      Image,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Mulai menulis...' }),
    ],
    content: value,
    editorProps: { attributes: { 'aria-label': 'Isi artikel', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });

  // useEditorState harus dibuat saat editor sudah ada, jadi dipisah ke komponen sendiri.
  if (!editor) return <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-200" />;
  return <Editor editor={editor} onUploadImage={onUploadImage} />;
}

function Editor({ editor, onUploadImage }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'),
        strike: e.isActive('strike'), mark: e.isActive('highlight'), p: e.isActive('paragraph'),
        h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }), h4: e.isActive('heading', { level: 4 }),
        left: e.isActive({ textAlign: 'left' }), center: e.isActive({ textAlign: 'center' }),
        right: e.isActive({ textAlign: 'right' }), justify: e.isActive({ textAlign: 'justify' }),
        ul: e.isActive('bulletList'), ol: e.isActive('orderedList'), quote: e.isActive('blockquote'),
        code: e.isActive('code'), block: e.isActive('codeBlock'), link: e.isActive('link'),
        undo: e.can().undo(), redo: e.can().redo(),
      },
  });

  if (!s) return null;
  const c = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL (kosongkan untuk hapus):', prev);
    if (url === null) return;
    if (url === '') return c().extendMarkRange('link').unsetLink().run();
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return alert('URL harus diawali http://, https://, atau mailto:');
    c().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        c().setImage({ src: await onUploadImage(file), alt: file.name.replace(/\.[^.]+$/, '') }).run();
      } catch (e) {
        alert(e.message);
      }
    };
    input.click();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-2" role="toolbar" aria-label="Format teks">
        <Btn title="Bold" active={s.bold} onClick={() => c().toggleBold().run()}><Bold size={16} /></Btn>
        <Btn title="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}><Italic size={16} /></Btn>
        <Btn title="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}><Underline size={16} /></Btn>
        <Btn title="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><Strikethrough size={16} /></Btn>
        <Btn title="Highlight" active={s.mark} onClick={() => c().toggleHighlight().run()}><Highlighter size={16} /></Btn>
        <Sep />
        <Btn title="Paragraf" active={s.p} onClick={() => c().setParagraph().run()}><Pilcrow size={16} /></Btn>
        <Btn title="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
        <Btn title="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
        <Btn title="Heading 4" active={s.h4} onClick={() => c().toggleHeading({ level: 4 }).run()}><Heading4 size={16} /></Btn>
        <Sep />
        <Btn title="Rata kiri" active={s.left} onClick={() => c().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
        <Btn title="Rata tengah" active={s.center} onClick={() => c().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
        <Btn title="Rata kanan" active={s.right} onClick={() => c().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
        <Btn title="Rata kiri-kanan" active={s.justify} onClick={() => c().setTextAlign('justify').run()}><AlignJustify size={16} /></Btn>
        <Sep />
        <Btn title="Bullet list" active={s.ul} onClick={() => c().toggleBulletList().run()}><List size={16} /></Btn>
        <Btn title="Numbered list" active={s.ol} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
        <Btn title="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={16} /></Btn>
        <Btn title="Inline code" active={s.code} onClick={() => c().toggleCode().run()}><Code size={16} /></Btn>
        <Btn title="Code block" active={s.block} onClick={() => c().toggleCodeBlock().run()}><SquareCode size={16} /></Btn>
        <span className="mx-1 h-5 w-px bg-slate-300" />
        <Btn title="Tambah link" active={s.link} onClick={setLink}><Link2 size={16} /></Btn>
        <Btn title="Hapus link" disabled={!s.link} onClick={() => c().unsetLink().run()}><Link2Off size={16} /></Btn>
        <Btn title="Sisipkan gambar" onClick={addImage}><ImagePlus size={16} /></Btn>
        <Btn title="Garis pemisah" onClick={() => c().setHorizontalRule().run()}><Minus size={16} /></Btn>
        <Btn title="Hapus format" onClick={() => c().unsetAllMarks().clearNodes().run()}><Eraser size={16} /></Btn>
        <span className="ml-auto flex">
          <Btn title="Undo" disabled={!s.undo} onClick={() => c().undo().run()}><Undo2 size={16} /></Btn>
          <Btn title="Redo" disabled={!s.redo} onClick={() => c().redo().run()}><Redo2 size={16} /></Btn>
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
