"use server";

import type { SupabaseMember, SupabaseMemberUpdate } from "./types";
import { erase, perform, update } from "./api";

// when we resolve a member conflict, the cases are:
// - different members, keep both
// - same member, keep one and delete other, merge columns done on client side

export async function resolve_member_conflict_different_members(
  first_member_id: number,
  first_member_updated: SupabaseMember,
  second_member_id: number,
  second_member_updated: SupabaseMember,
) {
  await update.member(first_member_id, first_member_updated);
  await update.member(second_member_id, second_member_updated);
  await update.member_conflicts({
    first_member_id: first_member_id,
    second_member_id: second_member_id,
    resolved: true,
  });
  await perform.calculate_member_conflicts();
}

export async function resolve_member_conflict_merge(
  first_member_id: number,
  second_member_id: number,
  merged_member: SupabaseMemberUpdate,
) {
  delete merged_member.id;
  delete merged_member.created_at;
  delete merged_member.updated_at;

  for (const key in merged_member) {
    if (merged_member[key as keyof SupabaseMemberUpdate] === "") {
      delete merged_member[key as keyof SupabaseMemberUpdate];
    }
  }

  const result = await perform.resolve_member_conflict_merge(
    first_member_id,
    second_member_id,
    merged_member,
  );

  return result;
}

// NEW: Un-resolve a conflict (reopen it)
// Uses ONLY existing columns - no new fields needed!
export async function unresolve_member_conflict(
  first_member_id: number,
  second_member_id: number,
) {
  await update.member_conflicts({
    first_member_id: first_member_id,
    second_member_id: second_member_id,
    resolved: false, // Just flip this back to false!
  });
}