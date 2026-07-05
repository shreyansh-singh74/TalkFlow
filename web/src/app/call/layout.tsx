import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const Layout = ({ children }: Props) => {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {children}
    </main>
  );
};

export default Layout;
