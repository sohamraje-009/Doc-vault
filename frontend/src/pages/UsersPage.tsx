import { useState } from 'react';
import {
  Alert,
  Button,
  LinearProgress,
  MenuItem,
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
import { useAuth } from '@/contexts/AuthContext';

type UserForm = {
  full_name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  department_id: string;
};

const emptyForm: UserForm = {
  full_name: '',
  username: '',
  email: '',
  password: 'Password@123',
  role: 'employee',
  department_id: '',
};

function getApiError(error: unknown) {
  const axiosError = error as AxiosError<{ detail?: string | Array<{ msg: string }> }>;
  const detail = axiosError.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ');
  return 'Could not create the user. Check required fields and try again.';
}

export default function UsersPage() {
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [success, setSuccess] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => docvaultService.users() });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: docvaultService.departments });
  const create = useMutation({
    mutationFn: docvaultService.createUser,
    onSuccess: (user) => {
      setSuccess(`Created user ${user.username}.`);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      docvaultService.updateUser(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
  const remove = useMutation({
    mutationFn: docvaultService.deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const canCreate =
    form.full_name.trim() &&
    form.username.trim().length >= 3 &&
    form.email.trim() &&
    form.password.trim().length >= 8;

  const submit = () => {
    setSuccess(null);
    create.mutate({
      full_name: form.full_name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password.trim(),
      role: form.role,
      department_id: form.department_id || null,
    });
  };

  if (isLoading) return <LinearProgress />;
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Users</Typography>
      {success && <Alert severity="success">{success}</Alert>}
      {create.isError && <Alert severity="error">{getApiError(create.error)}</Alert>}
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField
            label="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <TextField
            label="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            helperText="Minimum 3 characters"
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <TextField
            label="Password"
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            helperText="Minimum 8 characters"
          />
          <TextField select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <MenuItem value="employee">Employee</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <TextField
            select
            label="Department"
            value={form.department_id}
            onChange={(e) => setForm({ ...form, department_id: e.target.value })}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">None</MenuItem>
            {departments.map((department) => (
              <MenuItem key={department.id} value={department.id}>
                {department.name}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={submit} disabled={!canCreate || create.isPending}>
            {create.isPending ? 'Creating...' : 'Create'}
          </Button>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.department_name}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell align="right">
                  <Button
                    disabled={user.id === currentUser?.id}
                    onClick={() =>
                      update.mutate({ id: user.id, payload: { status: user.status === 'active' ? 'inactive' : 'active' } })
                    }
                  >
                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button color="error" onClick={() => remove.mutate(user.id)}>
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
