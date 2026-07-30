import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/components/portal-cliente/PortalClienteDashboard";
import { SolicitarVooCliente } from "@/components/portal-cliente/SolicitarVooCliente";

export function PortalClienteDashboard() {
	return (
		<Layout>
			<div className="flex justify-end px-4 pt-4 sm:px-6">
				<SolicitarVooCliente />
			</div>
			<Dashboard />
		</Layout>
	);
}


export default PortalClienteDashboard;
