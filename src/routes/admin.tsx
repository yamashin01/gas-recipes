import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAdminSession } from "../lib/auth/require-admin";

export const Route = createFileRoute("/admin")({
	beforeLoad: () => requireAdminSession(),
	component: AdminLayout,
});

function AdminLayout() {
	return <Outlet />;
}
