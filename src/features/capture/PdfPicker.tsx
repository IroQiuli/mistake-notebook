import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Spinner } from '../../ui/Spinner';
import { renderPageBlob, type PdfDoc } from './pdf';

interface PdfPickerProps {
  doc: PdfDoc;
  fileName: string;
  onCancel: () => void;
  onPick: (blob: Blob) => void;
}

export function PdfPicker({ doc, fileName, onCancel, onPick }: PdfPickerProps) {
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setLoading(true);
    setError('');
    renderPageBlob(doc, page, 900)
      .then((res) => {
        if (cancelled) return;
        url = URL.createObjectURL(res.blob);
        setPreview(url);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('这一页渲染失败，换一页试试');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, page]);

  return (
    <Dialog open onClose={onCancel} title="从 PDF 截题" size="lg">
      <p className="mb-3 truncate text-xs text-zinc-500">{fileName}</p>

      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
        >
          <ChevronLeft size={16} />
          上一页
        </Button>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          第
          <input
            type="number"
            min={1}
            max={doc.numPages}
            value={page}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 1 && v <= doc.numPages) setPage(v);
            }}
            className="w-14 rounded-lg border border-zinc-200 px-2 py-1 text-center text-sm outline-none focus:border-orange-300"
          />
          / {doc.numPages} 页
        </div>
        <Button
          size="sm"
          onClick={() => setPage((p) => Math.min(doc.numPages, p + 1))}
          disabled={page >= doc.numPages || loading}
        >
          下一页
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className="mt-3 flex min-h-[240px] items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
        {loading && <Spinner className="text-zinc-400" />}
        {!loading && error && <p className="p-6 text-sm text-red-500">{error}</p>}
        {!loading && preview && (
          <img src={preview} alt={`第 ${page} 页`} className="max-h-[52vh] w-full object-contain" />
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <Button block onClick={onCancel}>
          取消
        </Button>
        <Button
          variant="primary"
          block
          disabled={loading || picking || Boolean(error)}
          onClick={async () => {
            setPicking(true);
            try {
              const res = await renderPageBlob(doc, page, 1800);
              onPick(res.blob);
            } catch (err) {
              console.error(err);
              setError('导出这一页失败');
            } finally {
              setPicking(false);
            }
          }}
        >
          {picking ? '渲染中…' : `截取第 ${page} 页`}
        </Button>
      </div>
    </Dialog>
  );
}
