import type { AuthProfile, User } from "@/core/domain/user";
import { useDict } from "@/hooks/useDict";
import { AccountRow } from "@/screens/Settings/rows";

interface Props {
  user: User | null;
  profile: AuthProfile | null;
  onPress: () => void;
}

/** Account entry row — the one setting tied to *who* is listening. */
export function AccountSection({ user, profile, onPress }: Readonly<Props>) {
  const dict = useDict();

  return (
    <AccountRow user={user} profile={profile} dict={dict} onPress={onPress} />
  );
}
