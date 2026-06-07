import { useState } from 'react';
import {
  Alert,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { docvaultService } from '@/services/docvaultService';

function getApiError(error: unknown, fallback = 'Could not create department. Check the department name and try again.') {
  const axiosError = error as AxiosError<{ detail?: string | Array<{ msg: string }> }>;
  const detail = axiosError.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ');
  return fallback;
}

export default function DepartmentsPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['departments'], queryFn: docvaultService.departments });
  const create = useMutation({
    mutationFn: docvaultService.createDepartment,
    onSuccess: (department) => {
      setName('');
      setDescription('');
      setSuccess(`Created department ${department.name}.`);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['topbar-activity'] });
    },
  });
  const remove = useMutation({
    mutationFn: docvaultService.deleteDepartment,
    onSuccess: () => {
      setSuccess('Department deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['topbar-activity'] });
    },
  });

  const submit = () => {
    setSuccess(null);
    create.mutate({ name: name.trim(), description: description.trim() || null });
  };

  if (isLoading) return <LinearProgress />;
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Departments</Typography>
      {success && <Alert severity="success">{success}</Alert>}
      {create.isError && <Alert severity="error">{getApiError(create.error)}</Alert>}
      {remove.isError && <Alert severity="error">{getApiError(remove.error, 'Could not delete department. Check whether it is still in use.')}</Alert>}
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField
            label="Department name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            required
            error={create.isError}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Creating...' : 'Create'}
          </Button>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Documents</TableCell>
              <TableCell>Users</TableCell>
              <TableCell>Downloads</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((department) => (
              <TableRow key={department.id}>
                <TableCell>{department.name}</TableCell>
                <TableCell>{department.description}</TableCell>
                <TableCell>{department.total_documents}</TableCell>
                <TableCell>{department.total_users}</TableCell>
                <TableCell>{department.total_downloads}</TableCell>
                <TableCell align="right">
                  <Button
                    color="error"
                    onClick={() => {
                      if (window.confirm(`Delete "${department.name}"?`)) {
                        setSuccess(null);
                        remove.mutate(department.id);
                      }
                    }}
                    disabled={(department.total_documents ?? 0) > 0 || remove.isPending}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
