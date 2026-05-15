import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Rich Picks",
  description: "Manage your film collection",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
