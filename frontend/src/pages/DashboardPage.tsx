import { Box, Chip, Grid2 as Grid, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FolderIcon from '@mui/icons-material/Folder';
import GroupIcon from '@mui/icons-material/Group';
import DescriptionIcon from '@mui/icons-material/Description';
import { useQuery } from '@tanstack/react-query';
import { docvaultService } from '@/services/docvaultService';

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: 'divider' }} elevation={0}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ color: 'primary.main', bgcolor: 'primary.50', display: 'grid', placeItems: 'center' }}>{icon}</Box>
        <Box>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: docvaultService.dashboard });
  if (isLoading || !data) return <LinearProgress />;
  const maxDept = Math.max(1, ...data.documents_by_department.map((item) => item.value));

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Devgiri Forgings</Typography>
        <Typography color="text.secondary">Secure Enterprise Document Management System</Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="Total Documents" value={data.total_documents} icon={<DescriptionIcon />} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="Total Downloads" value={data.total_downloads} icon={<DownloadIcon />} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="Total Departments" value={data.total_departments} icon={<FolderIcon />} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="Total Users" value={data.total_users} icon={<GroupIcon />} /></Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: 'divider' }} elevation={0}>
            <Typography variant="h6" gutterBottom>Documents By Department</Typography>
            <Stack spacing={1.5}>
              {data.documents_by_department.map((item) => (
                <Box key={item.name}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2">{item.name}</Typography><Typography variant="body2">{item.value}</Typography></Stack>
                  <LinearProgress variant="determinate" value={(item.value / maxDept) * 100} sx={{ height: 8, borderRadius: 1, mt: 0.75 }} />
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: 'divider' }} elevation={0}>
            <Typography variant="h6" gutterBottom>Recent Activity</Typography>
            <Stack spacing={1.25}>
              {data.recent_activity.map((item) => (
                <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={item.action.replaceAll('_', ' ')} />
                  <Typography variant="body2" noWrap>{item.details || item.user_name || 'System activity'}</Typography>
                </Stack>
              ))}
              {data.recent_activity.length === 0 && <Typography color="text.secondary">No activity yet.</Typography>}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
