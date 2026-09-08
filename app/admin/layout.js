import WorkspaceShell from '../../components/WorkspaceShell';
export const metadata = { title: 'Workspace' };

export default function AdminLayout({ children }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
