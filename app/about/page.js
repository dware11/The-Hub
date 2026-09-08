import { canReview, getViewer } from '../../lib/auth';
import WhoIsCodeExperience from '../../components/WhoIsCodeExperience';
export const metadata = { title: 'Who Is C.O.D.E.?' };

export default async function AboutPage() {
  const viewer = await getViewer();
  return <WhoIsCodeExperience showWorkspace={canReview(viewer)} />;
}
