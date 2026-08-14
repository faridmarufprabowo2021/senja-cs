"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { TeamMember, TenantRole } from "@cs/shared";
import { Badge, Button, Card, Input, PageHeader, StatusDot } from "@/components/ui";
import { api, getSession } from "@/lib/api";
import { avatarGradient, initials } from "@/lib/utils";

const ROLE_LABEL: Record<TenantRole, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent",
};

export default function TeamPage() {
  const session = getSession();
  const me = session?.user;
  const myRole = (session?.tenants.find((t) => t.id === session.tenantId)?.role ??
    "agent") as TenantRole;
  const canManage = myRole === "owner" || myRole === "admin";

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await api<TeamMember[]>("/team/members");
      setMembers(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat tim");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite() {
    if (!email.trim()) {
      setError("Email wajib diisi");
      return;
    }
    setBusy(true);
    setError("");
    setTempPassword(null);
    try {
      const res = await api<TeamMember & { created?: boolean; tempPassword?: string }>(
        "/team/members",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim() || undefined,
            role,
            createIfMissing: true,
          }),
        },
      );
      setInvitedEmail(res.email);
      if (res.tempPassword) setTempPassword(res.tempPassword);
      setEmail("");
      setName("");
      setShowInvite(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal undang");
    } finally {
      setBusy(false);
    }
  }

  async function setMemberRole(userId: string, next: "admin" | "agent") {
    setBusy(true);
    setError("");
    try {
      await api(`/team/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal ubah role");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Keluarkan member dari workspace ini?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/team/members/${userId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal keluarkan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Tim"
        description="Undang agent/admin ke workspace. Role: owner, admin, agent."
        action={
          canManage ? (
            <Button onClick={() => setShowInvite((v) => !v)}>
              {showInvite ? "Tutup" : "Undang member"}
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-sm text-[var(--color-sunset)]">
          {error}
        </p>
      ) : null}

      {tempPassword ? (
        <Card className="mb-4 border-[color-mix(in_oklab,var(--color-accent)_30%,white)] bg-[var(--color-accent-soft)] p-4">
          <p className="text-sm font-medium text-[var(--color-accent)]">
            Akun baru dibuat untuk {invitedEmail}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Password sementara (tampil sekali — bagikan ke rekan Anda):
          </p>
          <code className="mt-2 block rounded-lg bg-white px-3 py-2 text-sm font-semibold tracking-wide">
            {tempPassword}
          </code>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard.writeText(
                `Login Senja CS\nEmail: ${invitedEmail}\nPassword: ${tempPassword}\n${typeof window !== "undefined" ? window.location.origin + "/login" : ""}`,
              );
            }}
          >
            Salin kredensial
          </Button>
        </Card>
      ) : null}

      {showInvite && canManage ? (
        <Card className="mb-6 space-y-3 p-5">
          <h2 className="text-sm font-medium">Undang ke workspace</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Jika email belum punya akun, sistem membuat akun + password sementara.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@toko.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Nama (opsional)
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Budi"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Role
            </label>
            <div className="flex gap-2">
              {(["agent", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    role === r
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-paper-2)] text-[var(--color-muted)]"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => void invite()} disabled={busy}>
            {busy ? "Mengundang…" : "Undang"}
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Memuat tim…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((a, i) => {
            const isMe = a.id === me?.id;
            const canEdit =
              canManage && !isMe && a.role !== "owner" && a.status === "active";
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className={`p-4 ${a.status === "disabled" ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                      style={{ background: avatarGradient(40 + i * 70) }}
                    >
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{a.name}</span>
                        {isMe ? <Badge tone="accent">Anda</Badge> : null}
                        <Badge
                          tone={
                            a.role === "owner"
                              ? "accent"
                              : a.role === "admin"
                                ? "warn"
                                : "default"
                          }
                        >
                          {ROLE_LABEL[a.role]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                        {a.email}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                        <StatusDot
                          status={a.status === "active" ? "online" : "offline"}
                        />
                        {a.status}
                      </div>
                      {canEdit ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {a.role === "agent" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void setMemberRole(a.id, "admin")}
                            >
                              Jadikan admin
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void setMemberRole(a.id, "agent")}
                            >
                              Jadikan agent
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => void removeMember(a.id)}
                          >
                            Keluarkan
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
