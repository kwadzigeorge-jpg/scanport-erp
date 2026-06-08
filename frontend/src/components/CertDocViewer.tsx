import { useState, useRef } from 'react';
import {
  DocumentArrowUpIcon, DocumentMagnifyingGlassIcon,
  TrashIcon, XMarkIcon, ArrowTopRightOnSquareIcon,
  PhotoIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { uploadCertDocument, removeCertDocument } from '../api/certifications';
import type { Certification } from '../types';
import toast from 'react-hot-toast';

interface Props {
  cert: Certification;
  canEdit: boolean;
  onUpdated: (updated: Certification) => void;
}

function isImage(url: string) {
  return /\.(jpe?g|png|webp)$/i.test(url);
}

export default function CertDocViewer({ cert, canEdit, onUpdated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadCertDocument(cert.id, file);
      toast.success('Certificate attached.');
      onUpdated(updated);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (!confirm('Remove the attached certificate document?')) return;
    try {
      await removeCertDocument(cert.id);
      toast.success('Attachment removed.');
      onUpdated({ ...cert, documentUrl: undefined, documentName: undefined });
    } catch {
      toast.error('Remove failed.');
    }
  }

  const url = cert.documentUrl;
  const name = cert.documentName ?? 'Certificate';
  const img = url && isImage(url);

  return (
    <div className="flex items-center gap-2">
      {url ? (
        <>
          {/* Thumbnail / file icon */}
          <button
            onClick={() => img ? setLightbox(true) : window.open(url, '_blank')}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition group"
            title="View certificate"
          >
            {img ? (
              <img
                src={url}
                alt="Certificate thumbnail"
                className="w-8 h-8 rounded object-cover border border-blue-200 group-hover:ring-2 ring-blue-300 transition"
              />
            ) : (
              <span className="w-8 h-8 rounded bg-red-50 border border-red-200 flex items-center justify-center group-hover:ring-2 ring-red-300 transition">
                <DocumentTextIcon className="w-4 h-4 text-red-500" />
              </span>
            )}
            <span className="max-w-[90px] truncate hidden sm:inline">{name}</span>
            <DocumentMagnifyingGlassIcon className="w-3.5 h-3.5 flex-shrink-0" />
          </button>

          {/* Open in new tab */}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            title="Open in new tab"
          >
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </a>

          {/* Replace / Remove (admin only) */}
          {canEdit && (
            <>
              <label
                className="p-1 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition cursor-pointer"
                title="Replace certificate"
              >
                <DocumentArrowUpIcon className="w-3.5 h-3.5" />
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFile}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleRemove}
                className="p-1 rounded hover:bg-red-50 text-red-300 hover:text-red-500 transition"
                title="Remove attachment"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </>
      ) : canEdit ? (
        /* No doc yet – upload button */
        <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2.5 py-1.5 rounded-lg border transition
          ${uploading
            ? 'border-gray-200 text-gray-400 bg-gray-50'
            : 'border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 hover:border-blue-400'}`}>
          {uploading ? (
            <><div className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" /> Uploading…</>
          ) : (
            <><DocumentArrowUpIcon className="w-3.5 h-3.5" /> Attach</>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
        </label>
      ) : (
        <span className="text-xs text-gray-300 italic">No attachment</span>
      )}

      {/* Image lightbox */}
      {lightbox && url && img && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-gray-900 rounded-t-xl px-4 py-2.5">
              <div className="flex items-center gap-2 text-white text-sm">
                <PhotoIcon className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-white transition p-1"
                  title="Open in new tab"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setLightbox(false)}
                  className="text-gray-400 hover:text-white transition p-1"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <img
              src={url}
              alt={name}
              className="w-full max-h-[80vh] object-contain rounded-b-xl bg-gray-800"
            />
          </div>
        </div>
      )}
    </div>
  );
}
