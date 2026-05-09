export const metadata = {
  title: 'Admin Portal',
  description: 'School Management System',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
