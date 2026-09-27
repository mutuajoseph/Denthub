import { AppShell, type AppShellProps } from "./AppShell";

export type PageWrapperProps = AppShellProps;

export function PageWrapper(props: PageWrapperProps) {
  return <AppShell {...props} />;
}
