import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/roles";

type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];

export type CrewRole = AppRole;

export interface CrewMember {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  roles: CrewRole[];
}

export async function fetchCrewMembers(): Promise<CrewMember[]> {
  const targetRoles: CrewRole[] = ["tripulante", "piloto_chefe"];

  const { data: roleAssignments, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", targetRoles);

  if (rolesError) {
    throw rolesError;
  }

  if (!roleAssignments || roleAssignments.length === 0) {
    return [];
  }

  const rolesByUser = new Map<string, Set<CrewRole>>();

  for (const assignment of roleAssignments) {
    if (!assignment?.user_id || !assignment?.role) {
      continue;
    }

    const role = assignment.role as CrewRole;

    if (!rolesByUser.has(assignment.user_id)) {
      rolesByUser.set(assignment.user_id, new Set());
    }

    rolesByUser.get(assignment.user_id)!.add(role);
  }

  const userIds = Array.from(rolesByUser.keys());

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, phone, avatar_url")
    .in("id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  const crewMembers: CrewMember[] = userIds
    .map((userId) => {
      const profile = profileMap.get(userId) as UserProfileRow | undefined;

      if (!profile) {
        return null;
      }

      const roles = Array.from(rolesByUser.get(userId) ?? []);

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone !== null && profile.phone !== undefined ? String(profile.phone) : null,
        avatar_url: profile.avatar_url,
        roles: roles,
      } satisfies CrewMember;
    })
    .filter((member): member is CrewMember => Boolean(member));

  return crewMembers.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
}