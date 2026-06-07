import { useState } from 'react';
import { Chip, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { docvaultService, formatDateTime } from '@/services/docvaultService';

export default function ActivityPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['activity', search], queryFn: () => docvaultService.activity({ search, page_size: 100 }) });
  if (isLoading) return <LinearProgress />;
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Activity Center</Typography>
      <TextField label="Search activity" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Table><TableHead><TableRow><TableCell>Time</TableCell><TableCell>User</TableCell><TableCell>Action</TableCell><TableCell>Details</TableCell><TableCell>IP</TableCell></TableRow></TableHead><TableBody>
          {(data?.items ?? []).map((item) => <TableRow key={item.id}><TableCell>{formatDateTime(item.created_at)}</TableCell><TableCell>{item.user_name || 'System'}</TableCell><TableCell><Chip size="small" label={item.action.replaceAll('_', ' ')} /></TableCell><TableCell>{item.details}</TableCell><TableCell>{item.ip_address}</TableCell></TableRow>)}
        </TableBody></Table>
      </Paper>
    </Stack>
  );
}
