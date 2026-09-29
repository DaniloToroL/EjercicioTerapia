import { AthleteHeader, AthleteTabs } from "@/components/athlete/athlete-nav";
import { isCoach, requireUser } from "@/lib/auth";

export default async function AthleteLayout({ children }: LayoutProps<"/atleta">) {
  const user = await requireUser();
  return (
    <div className="flex min-h-svh flex-1 flex-col bg-muted/30">
      <AthleteHeader name={user.name} isCoach={isCoach(user)} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</main>
      <AthleteTabs />
    </div>
  );
}
