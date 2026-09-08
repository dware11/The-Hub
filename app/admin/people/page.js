import { getViewer, isAdmin, isSuperAdmin } from '../../../lib/auth';
import { getPeopleRoster } from '../../../lib/peopleData';
import PeopleAccessManager from './PeopleAccessManager';
import { getAccessRequests } from '../../../lib/committeeData';
export default async function PeoplePage(){const viewer=await getViewer();if(!viewer.user||!isAdmin(viewer))return <div className="auth-card"><h1>Administrator access required</h1><p>People &amp; Access is restricted to administrators and super administrators.</p></div>;return <div className="review-page workspace-subpage"><div className="workspace-page-heading"><div><div className="eyebrow">Workspace access</div><h1>People &amp; Access</h1><p>Manage contributor requests and approved access with clear accountability.</p></div></div><PeopleAccessManager rows={await getPeopleRoster(viewer)} requests={await getAccessRequests()} superAdmin={isSuperAdmin(viewer)} /></div>}
