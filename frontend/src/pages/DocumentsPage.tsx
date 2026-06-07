import { useMemo, useState } from 'react';
import { Alert, Box, Chip, IconButton, LinearProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { docvaultService, formatBytes, formatDate } from '@/services/docvaultService';
import { useAuth } from '@/contexts/AuthContext';
import type { DocumentItem } from '@/types/docvault';

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const params = useMemo(() => ({ search: search || undefined, department_id: departmentId || undefined, page_size: 50 }), [search, departmentId]);
  const { data, isLoading } = useQuery({ queryKey: ['documents', params], queryFn: () => docvaultService.documents(params) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: docvaultService.departments });
  const deleteMutation = useMutation({ mutationFn: docvaultService.deleteDocument, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }) });

  const readErrorDetail = async (error: unknown) => {
    const response = (error as { response?: { data?: unknown; status?: number } }).response;
    const data = response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()) as { detail?: string };
        if (parsed.detail) return parsed.detail;
      } catch {
        return `Preview failed with status ${response?.status ?? 'unknown'}.`;
      }
    }
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data) as { detail?: string };
        if (parsed.detail) return parsed.detail;
      } catch {
        return data;
      }
    }
    return null;
  };

  const confirmDeleteDocument = (doc: DocumentItem) => {
    const approved = window.confirm(`Delete "${doc.title}"? This action cannot be undone.`);
    if (approved) {
      deleteMutation.mutate(doc.id);
    }
  };

  const fetchDocumentBlob = async (doc: DocumentItem, mode: 'preview' | 'download') => {
    const response = await api.get<Blob>(`/documents/${doc.id}/${mode}`, { responseType: 'blob' });
    const contentType = response.headers['content-type'];
    const type = typeof contentType === 'string' ? contentType : 'application/octet-stream';
    return URL.createObjectURL(new Blob([response.data], { type }));
  };

  const pdfPreviewTypes = ['PDF'];
  const imagePreviewTypes = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG', 'BMP', 'ICO', 'AVIF', 'HEIC', 'HEIF'];
  const unsupportedBrowserImageTypes = ['RAW', 'CR2', 'NEF', 'ARW', 'DNG', 'PSD'];
  const audioPreviewTypes = ['MP3', 'WAV', 'OGG', 'M4A', 'AAC', 'FLAC'];
  const videoPreviewTypes = ['MP4', 'WEBM', 'OGV', 'MOV'];

  const escapeHtml = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

  const writePreviewShell = (viewer: Window, title: string, content: string) => {
    viewer.document.open();
    viewer.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; background: #111827; color: #f9fafb; }
            header { height: 48px; display: flex; align-items: center; padding: 0 16px; background: #ffffff; color: #111827; border-bottom: 1px solid #e5e7eb; }
            main { height: calc(100vh - 49px); display: flex; align-items: center; justify-content: center; overflow: auto; }
            img, video { max-width: 100%; max-height: 100%; }
            iframe, embed { width: 100%; height: 100%; border: 0; background: #ffffff; }
            audio { width: min(720px, calc(100vw - 48px)); }
          </style>
        </head>
        <body>
          <header>${escapeHtml(title)}</header>
          <main>${content}</main>
        </body>
      </html>
    `);
    viewer.document.close();
  };

  const previewDocument = async (doc: DocumentItem) => {
    setFileError(null);
    const viewer = window.open('', '_blank');
    if (!viewer) {
      setFileError('Pop-up was blocked. Allow pop-ups for Devgiri Forgings to preview documents.');
      return;
    }
    viewer.document.write('<title>Loading preview...</title><body style="font-family: Arial, sans-serif; padding: 24px;">Loading preview...</body>');
    try {
      const fileType = doc.file_type.toUpperCase();
      if (pdfPreviewTypes.includes(fileType)) {
        const url = await fetchDocumentBlob(doc, 'preview');
        writePreviewShell(viewer, doc.file_name, `<embed src="${url}" type="application/pdf" />`);
        setTimeout(() => URL.revokeObjectURL(url), 300_000);
      } else if (imagePreviewTypes.includes(fileType)) {
        const url = await fetchDocumentBlob(doc, 'preview');
        writePreviewShell(viewer, doc.file_name, `<img src="${url}" alt="${escapeHtml(doc.file_name)}" />`);
        setTimeout(() => URL.revokeObjectURL(url), 300_000);
      } else if (unsupportedBrowserImageTypes.includes(fileType)) {
        const response = await api.get<string>(`/documents/${doc.id}/preview-html`, { responseType: 'text' });
        viewer.document.open();
        viewer.document.write(response.data);
        viewer.document.close();
      } else if (audioPreviewTypes.includes(fileType)) {
        const url = await fetchDocumentBlob(doc, 'preview');
        writePreviewShell(viewer, doc.file_name, `<audio src="${url}" controls autoplay></audio>`);
        setTimeout(() => URL.revokeObjectURL(url), 300_000);
      } else if (videoPreviewTypes.includes(fileType)) {
        const url = await fetchDocumentBlob(doc, 'preview');
        writePreviewShell(viewer, doc.file_name, `<video src="${url}" controls autoplay></video>`);
        setTimeout(() => URL.revokeObjectURL(url), 300_000);
      } else {
        const response = await api.get<string>(`/documents/${doc.id}/preview-html`, { responseType: 'text' });
        viewer.document.open();
        viewer.document.write(response.data);
        viewer.document.close();
      }
      viewer.focus();
    } catch (error) {
      viewer.close();
      const detail = await readErrorDetail(error);
      setFileError(detail ? `Could not open preview: ${detail}` : 'Could not open preview. Download the file or try another document.');
    }
  };

  const downloadDocument = async (doc: DocumentItem) => {
    setFileError(null);
    try {
      const url = await fetchDocumentBlob(doc, 'download');
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFileError('Could not download the document. Please sign in again and retry.');
    }
  };

  const printDocument = async (doc: DocumentItem) => {
    setFileError(null);
    const printableTypes = ['PDF', 'JPG', 'JPEG', 'PNG'];
    if (!printableTypes.includes(doc.file_type.toUpperCase())) {
      setFileError('This file type cannot be printed directly in the browser. Download it and print from its native application.');
      return;
    }

    try {
      const url = await fetchDocumentBlob(doc, 'preview');
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.src = url;
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 3000);
      };
      document.body.appendChild(frame);
    } catch {
      setFileError('Could not print the document. Please sign in again or try another file.');
    }
  };

  if (isLoading) return <LinearProgress />;
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box><Typography variant="h4">Documents</Typography><Typography color="text.secondary">Search, preview, download, and print repository files.</Typography></Box>
        <TextField select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} sx={{ minWidth: 260 }}>
          <MenuItem value="">All departments</MenuItem>
          {departments.map((department) => <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>)}
        </TextField>
      </Stack>
      {fileError && <Alert severity="error">{fileError}</Alert>}
      <TextField label="Global search" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth />
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Table>
          <TableHead><TableRow><TableCell>Document Name</TableCell><TableCell>Department</TableCell><TableCell>Uploaded By</TableCell><TableCell>Type</TableCell><TableCell>Size</TableCell><TableCell>Upload Date</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {(data?.items ?? []).map((doc) => (
              <TableRow key={doc.id} hover>
                <TableCell><Typography fontWeight={600}>{doc.title}</Typography><Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>{doc.tags.map((tag) => <Chip key={tag} label={tag} size="small" />)}</Stack></TableCell>
                <TableCell>{doc.department_name}</TableCell>
                <TableCell>{doc.uploaded_by_name || 'System'}</TableCell>
                <TableCell>{doc.file_type}</TableCell>
                <TableCell>{formatBytes(doc.file_size)}</TableCell>
                <TableCell>{formatDate(doc.created_at)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Preview"><IconButton onClick={() => void previewDocument(doc)}><VisibilityIcon /></IconButton></Tooltip>
                  <Tooltip title="Download"><IconButton onClick={() => void downloadDocument(doc)}><DownloadIcon /></IconButton></Tooltip>
                  <Tooltip title="Print"><IconButton onClick={() => void printDocument(doc)}><PrintIcon /></IconButton></Tooltip>
                  {isAdmin && <Tooltip title="Delete"><IconButton color="error" onClick={() => confirmDeleteDocument(doc)}><DeleteIcon /></IconButton></Tooltip>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!data?.items.length && <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No documents found.</Typography></Box>}
      </Paper>
      <Typography variant="body2" color="text.secondary">{data?.total ?? 0} documents</Typography>
    </Stack>
  );
}
