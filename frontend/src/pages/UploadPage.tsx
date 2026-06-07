import { useState } from 'react';
import { Alert, Button, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { docvaultService } from '@/services/docvaultService';

export default function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: docvaultService.departments });
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [tags, setTags] = useState('invoice, audit');
  const [description, setDescription] = useState('');
  const [lastUploadCount, setLastUploadCount] = useState(0);
  const upload = useMutation({
    mutationFn: async () => {
      for (const selectedFile of files) {
        const data = new FormData();
        const relativePath = selectedFile.webkitRelativePath || selectedFile.name;
        data.append('file', selectedFile);
        data.append('title', files.length === 1 && title.trim() ? title.trim() : relativePath);
        data.append('department_id', departmentId);
        data.append('tags', tags);
        data.append('description', description);
        await docvaultService.uploadDocument(data);
      }
      return files.length;
    },
    onSuccess: (count) => {
      setLastUploadCount(count);
      setFiles([]);
      setTitle('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['topbar-activity'] });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!files.length) return;
    upload.mutate();
  };

  const selectedLabel =
    files.length === 0
      ? 'No file selected'
      : files.length === 1
        ? files[0].name
        : `${files.length} files selected`;

  return (
    <Stack spacing={2} maxWidth={820}>
      <Typography variant="h4">Upload Document</Typography>
      <Typography color="text.secondary">Add a validated document to the secure repository with department ownership and searchable tags.</Typography>
      <Paper component="form" onSubmit={submit} elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Stack spacing={2}>
          {upload.isSuccess && (
            <Alert
              severity="success"
              action={<Button color="inherit" size="small" onClick={() => navigate('/documents')}>View</Button>}
            >
              {lastUploadCount > 1 ? 'Documents uploaded successfully.' : 'Document uploaded successfully.'}
            </Alert>
          )}
          {upload.isError && <Alert severity="error">Upload failed. Check file type, size, and required fields.</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
              Choose file
              <input
                hidden
                type="file"
                multiple
                onChange={(e) => {
                  setFiles(e.target.files ? Array.from(e.target.files) : []);
                  setTitle('');
                }}
              />
            </Button>
            <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
              Choose folder
              <input
                hidden
                type="file"
                multiple
                {...{ webkitdirectory: '', directory: '' }}
                onChange={(e) => {
                  setFiles(e.target.files ? Array.from(e.target.files) : []);
                  setTitle('');
                }}
              />
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">{selectedLabel}</Typography>
          <TextField
            label="Document Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={files.length > 1}
            helperText={files.length > 1 ? 'Multiple uploads use each file name as the document name.' : 'Leave blank to use the file name.'}
          />
          <TextField select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
            {departments.map((department) => <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>)}
          </TextField>
          <TextField label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} helperText="Separate tags with commas." />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={3} />
          {upload.isPending && <LinearProgress />}
          <Button type="submit" variant="contained" disabled={!files.length || !departmentId || upload.isPending} sx={{ alignSelf: 'flex-start' }}>
            {files.length > 1 ? 'Upload Documents' : 'Upload Document'}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
