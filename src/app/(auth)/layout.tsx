import { getUserFromCookies } from '@/lib/helper';
import UserProvider from '../component/context/user-context';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { ReactNode } from 'react';
import CrmAiAssistant from '@/components/CrmAiAssistant';
import { isMarketingExecutive, isMarketingPageAllowed, MARKETING_HOME } from '@/lib/roles';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userDoc = await getUserFromCookies();

  if (!userDoc) {
    redirect('/login');
  }

  const user = JSON.parse(JSON.stringify(userDoc));
  const isMarketing = isMarketingExecutive(user.role);

  // Marketing Executives only get their own dashboard (the proxy passes the requested path).
  // Their APIs are restricted in the proxy as well, so other pages would be empty anyway.
  if (isMarketing) {
    const pathname = (await headers()).get('x-pathname') || '';
    // (no path header -> no redirect, to avoid a loop; data access is still enforced by the API proxy)
    if (pathname && !isMarketingPageAllowed(pathname)) {
      redirect(MARKETING_HOME);
    }
  }

  return (
    <UserProvider user={user}>
      {children}
      {/* The AI assistant answers questions about finances and students: not for marketing */}
      {!isMarketing && <CrmAiAssistant />}
    </UserProvider>
  );
}
