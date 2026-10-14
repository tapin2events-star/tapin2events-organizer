import { Navigate } from 'react-router-dom';
import { useFeature } from '../../lib/preview';
import BusinessPlan from './BusinessPlan';

// Preview: only admins in Preview mode see the Business plan page for now.
export default function BusinessPlanGate() {
  const on = useFeature('business_plan_page');
  return on ? <BusinessPlan /> : <Navigate to="/business" replace />;
}
