import { useEffect, useState } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import ImageCropDialog from './ImageCropDialog.jsx';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, Heading2, Heading3, Heading4, Pilcrow,
  List, ListOrdered, Quote, Code, SquareCode, Link2, Link2Off, ImagePlus, Minus, Eraser,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo2, Redo2,
  Replace, Crop, Table2, FileUp, Rows3, Columns3, Trash2, TableCellsMerge, TableCellsSplit, PanelTop,
} from 'lucide-react';
import { mdToHtml, MD_MAX_BYTES } from '../lib/markdown.js';

const Sep = () => <span className="mx-1 h-5 w-px bg-slate-300" />;

function Btn({ title, active, disabled, onClick, children }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={!!active} disabled={disabled} onClick={onClick}
      className={`rounded-lg p-2 transition disabled:opacity-30 ${active ? 'bg-brand-1/15 text-brand-1' : 'text-slate-600 hover:bg-slate-100'}`}>
      {children}
    </button>
  );
}

// onMouseDown preventDefault: klik tombol tidak boleh mencuri fokus/seleksi dari gambar.
function ImgBtn({ label, danger, disabled, onClick, children }) {
  return (
    <button type="button" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      title={disabled ? `${label} (hanya untuk gambar yang sudah terunggah)` : label}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-30 ${danger ? 'hover:bg-rose-500' : 'hover:bg-white/15'}`}>
      {children} {label}
    </button>
  );
}

// width/height eksplisit -> tersimpan di HTML, mencegah CLS di Next.js. Server membuang kalau tidak berpasangan.
const SizedImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), width: { default: null }, height: { default: null } };
  },
});

// onImportMd({ title, description }) dipanggil setelah file .md dimuat. takeTitle: H1 pertama jadi judul.
export default function RichEditor({ value, onChange, onUploadImage, onImportMd, takeTitle }) {
  const editor = useEditor({
    // Astro SSR: hindari hydration mismatch.
    immediatelyRender: false,
    extensions: [
      // StarterKit v3 sudah memuat Link & Underline.
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true } }),
      SizedImage,
      Highlight,
      // resizable mati: lebar kolom dibuang sanitizer server, CSS yang mengatur.
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Mulai menulis...' }),
    ],
    content: value,
    editorProps: { attributes: { 'aria-label': 'Isi artikel', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });

  // useEditorState harus dibuat saat editor sudah ada, jadi dipisah ke komponen sendiri.
  if (!editor) return <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-200" />;
  return <Editor editor={editor} onUploadImage={onUploadImage} onImportMd={onImportMd} takeTitle={takeTitle} />;
}

function Editor({ editor, onUploadImage, onImportMd, takeTitle }) {
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
        imgSrc: e.isActive('image') ? e.getAttributes('image').src ?? '' : null,
        table: e.isActive('table'), merge: e.can().mergeCells(), split: e.can().splitCell(),
      },
  });

  const [cropFor, setCropFor] = useState(null); // { src, pos } gambar yang sedang di-crop

  // Gambar yang gagal dimuat (mis. path lokal dari .md) diberi class agar terlihat dan bisa diklik.
  // Event error tidak bubble, jadi pakai capture. Class hanya di DOM, tidak ikut tersimpan ke HTML.
  useEffect(() => {
    const dom = editor.view.dom;
    const mark = (e) => e.target.tagName === 'IMG' && e.target.classList.add('img-broken');
    const unmark = (e) => e.target.tagName === 'IMG' && e.target.classList.remove('img-broken');
    dom.addEventListener('error', mark, true);
    dom.addEventListener('load', unmark, true);
    return () => { dom.removeEventListener('error', mark, true); dom.removeEventListener('load', unmark, true); };
  }, [editor]);

  if (!s) return null;
  const c = () => editor.chain().focus();

  const pickImage = (onFile) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try { await onFile(file); } catch (e) { alert(e.message); }
    };
    input.click();
  };

  const replaceImage = () =>
    pickImage(async (file) => {
      const { url, width, height } = await onUploadImage(file);
      c().updateAttributes('image', { src: url, width, height }).run();
    });

  const openCrop = () => setCropFor({ src: editor.getAttributes('image').src, pos: editor.state.selection.from });

  const applyCrop = async (file) => {
    const { url, width, height } = await onUploadImage(file);
    editor.chain().focus().setNodeSelection(cropFor.pos).updateAttributes('image', { src: url, width, height }).run();
    setCropFor(null);
  };

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
        const { url, width, height } = await onUploadImage(file);
        c().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, ''), width, height }).run();
      } catch (e) {
        alert(e.message);
      }
    };
    input.click();
  };

  const importMd = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,text/markdown';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!/\.(md|markdown)$/i.test(file.name)) return alert('File harus berekstensi .md atau .markdown');
      if (file.size > MD_MAX_BYTES) return alert('File maksimal 1 MB');
      try {
        const { html, title, description, localImages } = mdToHtml(await file.text(), { takeTitle });
        if (!editor.isEmpty) {
          const replace = confirm('Isi artikel sudah ada.\n\nOK = ganti seluruh isi\nBatal = tambahkan di akhir');
          if (replace) editor.commands.setContent(html, { emitUpdate: true });
          else editor.chain().focus('end').insertContent(html).run();
        } else {
          editor.commands.setContent(html, { emitUpdate: true });
        }
        onImportMd?.({ title, description });
        if (localImages) alert(`${localImages} gambar memakai path lokal dan tidak akan tampil. Klik gambar yang rusak, lalu pilih Replace atau Delete.`);
      } catch (e) {
        alert(`Gagal membaca file: ${e.message}`);
      }
    };
    input.click();
  };

  return (
    <>
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="block text-sm font-medium text-slate-700">Isi artikel</span>
      <button type="button" onClick={importMd} title="Import file Markdown (.md)"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-1 hover:text-brand-1">
        <FileUp size={14} /> Import .md
      </button>
    </div>
    <div className="overflow-clip rounded-2xl border border-slate-200 bg-white transition focus-within:border-brand-1 focus-within:ring-4 focus-within:ring-brand-1/15">
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/95 p-2 shadow-sm backdrop-blur lg:top-0" role="toolbar" aria-label="Format teks">
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
        <Btn title="Sisipkan tabel" active={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} /></Btn>
        <Btn title="Garis pemisah" onClick={() => c().setHorizontalRule().run()}><Minus size={16} /></Btn>
        <Btn title="Hapus format" onClick={() => c().unsetAllMarks().clearNodes().run()}><Eraser size={16} /></Btn>
        <span className="ml-auto flex">
          <Btn title="Undo" disabled={!s.undo} onClick={() => c().undo().run()}><Undo2 size={16} /></Btn>
          <Btn title="Redo" disabled={!s.redo} onClick={() => c().redo().run()}><Redo2 size={16} /></Btn>
        </span>
        {s.table && (
          <div className="flex basis-full flex-wrap items-center gap-0.5 border-t border-brand-1/20 pt-2" role="toolbar" aria-label="Tabel">
            <span className="mr-2 rounded-md bg-brand-1/10 px-2 py-0.5 text-xs font-semibold text-brand-1">Tabel</span>
            <Btn title="Tambah baris di atas" onClick={() => c().addRowBefore().run()}><Rows3 size={16} /></Btn>
            <Btn title="Tambah baris di bawah" onClick={() => c().addRowAfter().run()}><Rows3 size={16} className="rotate-180" /></Btn>
            <Btn title="Hapus baris" onClick={() => c().deleteRow().run()}><Trash2 size={16} /></Btn>
            <Sep />
            <Btn title="Tambah kolom di kiri" onClick={() => c().addColumnBefore().run()}><Columns3 size={16} /></Btn>
            <Btn title="Tambah kolom di kanan" onClick={() => c().addColumnAfter().run()}><Columns3 size={16} className="rotate-180" /></Btn>
            <Btn title="Hapus kolom" onClick={() => c().deleteColumn().run()}><Trash2 size={16} /></Btn>
            <Sep />
            <Btn title="Baris header on/off" onClick={() => c().toggleHeaderRow().run()}><PanelTop size={16} /></Btn>
            <Btn title="Gabung sel" disabled={!s.merge} onClick={() => c().mergeCells().run()}><TableCellsMerge size={16} /></Btn>
            <Btn title="Pecah sel" disabled={!s.split} onClick={() => c().splitCell().run()}><TableCellsSplit size={16} /></Btn>
            <Sep />
            <button type="button" onClick={() => c().deleteTable().run()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Hapus tabel
            </button>
          </div>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>

    {/* appendTo body + fixed: wrapper editor overflow-clip akan memotong menu bila gambar di dekat tepi atas */}
    <BubbleMenu
      editor={editor}
      pluginKey="imageMenu"
      shouldShow={({ editor: e }) => e.isActive('image')}
      appendTo={() => document.body}
      options={{ strategy: 'fixed', placement: 'top', offset: 8 }}
      className="z-50"
    >
      <div role="toolbar" aria-label="Gambar" className="flex items-center gap-0.5 rounded-xl bg-slate-900 p-1 text-white shadow-xl shadow-slate-900/30 ring-1 ring-white/10">
        <ImgBtn label="Replace" onClick={replaceImage}><Replace size={15} /></ImgBtn>
        <ImgBtn label="Crop" disabled={!/^https?:\/\//i.test(s.imgSrc ?? '')} onClick={openCrop}><Crop size={15} /></ImgBtn>
        <span className="mx-0.5 h-5 w-px bg-white/20" />
        <ImgBtn label="Delete" danger onClick={() => c().deleteSelection().run()}><Trash2 size={15} /></ImgBtn>
      </div>
    </BubbleMenu>

    {cropFor && <ImageCropDialog src={cropFor.src} onCancel={() => setCropFor(null)} onDone={applyCrop} />}
    </>
  );
}
