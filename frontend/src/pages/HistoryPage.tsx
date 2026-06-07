import { useState } from 'react';
import { Button, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { docvaultService, fileUrl, formatDateTime } from '@/services/docvaultService';
import { useAuth } from '@/contexts/AuthContext';

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['history', search], queryFn: () => docvaultService.history({ search, page_size: 50 }), enabled: isAdmin });
  const clear = useMutation({ mutationFn: docvaultService.clearHistory, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history'] }) });
  if (!isAdmin) return <Typography>Download history is available to administrators only.</Typography>;
  if (isLoading) return <LinearProgress />;
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Stack><Typography variant="h4">Download History</Typography><Typography color="text.secondary">Auditable download trail with user, department, document, IP address, and timestamp.</Typography></Stack>
        <Stack direction="row" spacing={1}><Button startIcon={<FileDownloadIcon />} onClick={() => window.open(fileUrl('/history/export'), '_blank')}>Export CSV</Button><Button color="error" startIcon={<DeleteSweepIcon />} onClick={() => clear.mutate()}>Clear History</Button></Stack>
      </Stack>
      <TextField label="Search history" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Table><TableHead><TableRow><TableCell>Timestamp</TableCell><TableCell>User</TableCell><TableCell>Department</TableCell><TableCell>Document</TableCell><TableCell>IP Address</TableCell></TableRow></TableHead><TableBody>
          {(data?.items ?? []).map((item) => <TableRow key={item.id}><TableCell>{formatDateTime(item.downloaded_at)}</TableCell><TableCell>{item.user_name}</TableCell><TableCell>{item.department_name}</TableCell><TableCell>{item.document_name}</TableCell><TableCell>{item.ip_address}</TableCell></TableRow>)}
        </TableBody></Table>
      </Paper>
    </Stack>
  );
}
