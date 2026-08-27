import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const roles = ["ADMIN", "MENTOR", "INTERN"] as const;
type Role = (typeof roles)[number];

type UserPayload = {
  profileId?: string;
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  department?: string;
  cohortId?: string | null;
  projectGroup?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
};

function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedProfile(payload: UserPayload) {
  const role = payload.role;
  const name = asString(payload.name);
  const email = asString(payload.email).toLowerCase();
  const department = asString(payload.department);

  if (!name || !email.includes("@") || !department || !role || !isRole(role)) {
    return null;
  }

  const internFields = role === "INTERN"
    ? {
        cohort_id: asString(payload.cohortId),
        project_group: asString(payload.projectGroup) || null,
        start_date: asString(payload.startDate) || null,
        end_date: asString(payload.endDate) || null,
      }
    : {
        cohort_id: null,
        project_group: null,
        start_date: null,
        end_date: null,
      };

  if (role === "INTERN" && (!internFields.cohort_id || !internFields.start_date || !internFields.end_date)) {
    return null;
  }

  return {
    name,
    display_name: name,
    email,
    role,
    department,
    is_active: payload.isActive ?? true,
    ...internFields,
  };
}

async function requireAdmin() {
  const result = await getCurrentUser();
  if (result.status !== "authenticated" || result.user.role !== "ADMIN") return null;
  return result.user;
}

async function preventsLastAdminLoss(
  admin: ReturnType<typeof createAdminClient>,
  currentProfileId: string,
  profileId: string,
  existing: { role: Role; is_active: boolean },
  next: { role: Role; is_active: boolean },
) {
  if (profileId === currentProfileId && (next.role !== "ADMIN" || !next.is_active)) {
    return "현재 로그인한 관리자의 역할 또는 활성 상태는 변경할 수 없습니다.";
  }

  if (existing.role !== "ADMIN" || !existing.is_active || (next.role === "ADMIN" && next.is_active)) {
    return null;
  }

  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "ADMIN")
    .eq("is_active", true);
  if (error) return "관리자 계정 상태를 확인하지 못했습니다.";
  return (count ?? 0) <= 1 ? "마지막 활성 관리자는 비활성화하거나 역할을 변경할 수 없습니다." : null;
}

export async function POST(request: Request) {
  const requester = await requireAdmin();
  if (!requester) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });

  let payload: UserPayload;
  try {
    payload = await request.json() as UserPayload;
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const profile = normalizedProfile(payload);
  const password = asString(payload.password);
  if (!profile || password.length < 8) {
    return NextResponse.json({ message: "필수 정보와 8자 이상의 초기 비밀번호를 확인해 주세요." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: profile.email,
      password,
      email_confirm: true,
      user_metadata: { name: profile.name, display_name: profile.display_name },
    });
    if (authError || !authData.user) {
      return NextResponse.json({ message: authError?.message ?? "인증 계정을 생성하지 못했습니다." }, { status: 400 });
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update(profile)
      .eq("auth_user_id", authData.user.id);
    if (profileError) {
      return NextResponse.json({ message: `계정은 생성되었지만 프로필 설정에 실패했습니다: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "관리자 기능 설정을 확인해 주세요." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const requester = await requireAdmin();
  if (!requester) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });

  let payload: UserPayload;
  try {
    payload = await request.json() as UserPayload;
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const profileId = asString(payload.profileId);
  const nextProfile = normalizedProfile(payload);
  if (!profileId || !nextProfile) {
    return NextResponse.json({ message: "사용자 정보를 확인해 주세요." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("profiles")
      .select("id,auth_user_id,email,role,is_active")
      .eq("id", profileId)
      .maybeSingle();
    if (existingError || !existing) {
      return NextResponse.json({ message: "수정할 사용자를 찾지 못했습니다." }, { status: 404 });
    }

    const protectionError = await preventsLastAdminLoss(
      admin,
      requester.profileId,
      profileId,
      existing as { role: Role; is_active: boolean },
      { role: nextProfile.role, is_active: nextProfile.is_active },
    );
    if (protectionError) return NextResponse.json({ message: protectionError }, { status: 400 });

    if (existing.email.toLowerCase() !== nextProfile.email) {
      const { error: authError } = await admin.auth.admin.updateUserById(existing.auth_user_id, { email: nextProfile.email, email_confirm: true });
      if (authError) return NextResponse.json({ message: authError.message }, { status: 400 });
    }

    const { error: profileError } = await admin.from("profiles").update(nextProfile).eq("id", profileId);
    if (profileError) return NextResponse.json({ message: profileError.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "관리자 기능 설정을 확인해 주세요." }, { status: 503 });
  }
}
