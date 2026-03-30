import { Navigate } from "react-router-dom";

// Workspace creation now requires Stripe checkout.
// Redirect to /cadastro which handles the full signup + payment flow.
export default function CreateWorkspace() {
  return <Navigate to="/cadastro" replace />;
}
