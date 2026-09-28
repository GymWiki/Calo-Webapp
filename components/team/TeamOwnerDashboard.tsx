"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Mail, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  cancelTeam,
  inviteTeamMembers,
  removeTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
  transferTeamOwnership,
  updateTeamSettings,
} from "@/actions/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TEAM_PLAN_ORDER,
  TEAM_PLANS,
  type TeamPlan,
} from "@/lib/constants/subscriptionPlans";
import { openInSystemBrowser } from "@/lib/mobile/capacitor";
import type { SeatUsage, Team, TeamInvite, TeamMember } from "@/types/team";

const STATUS_LABELS: Record<Team["status"], { label: string; variant: "success" | "destructive" | "secondary" }> = {
  active: { label: "Actief", variant: "success" },
  past_due: { label: "Betaling verwerken — coulanceperiode", variant: "destructive" },
  canceled: { label: "Opgezegd", variant: "secondary" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export function TeamOwnerDashboard({
  team,
  members,
  invites,
  seatUsage,
  aiUsage,
}: {
  team: Team;
  members: TeamMember[];
  invites: TeamInvite[];
  seatUsage: SeatUsage | null;
  aiUsage: { used: number; limit: number; remaining: number };
}) {
  const router = useRouter();
  const statusInfo = STATUS_LABELS[team.status];
  const pendingInvites = invites.filter((i) => i.status === "pending");
  const seatsFull = seatUsage ? seatUsage.seatsAvailable <= 0 : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{team.name}</p>
              <p className="text-sm text-muted-foreground">
                {TEAM_PLANS[team.plan].label} · {TEAM_PLANS[team.plan].priceLabel}
                {TEAM_PLANS[team.plan].periodLabel}
              </p>
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          {seatUsage && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Seats gebruikt</span>
                <span className="font-medium">
                  {seatUsage.seatsUsed} van {seatUsage.seatLimit}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min((seatUsage.seatsUsed / seatUsage.seatLimit) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gepoold AI Lescoach-tegoed deze maand</span>
              <span className="font-medium">
                {aiUsage.remaining} van {aiUsage.limit} beschikbaar
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min((aiUsage.used / aiUsage.limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <InviteSection seatsFull={seatsFull} onDone={() => router.refresh()} />

      {pendingInvites.length > 0 && (
        <PendingInvitesCard invites={pendingInvites} onDone={() => router.refresh()} />
      )}

      <MembersCard members={members} onDone={() => router.refresh()} />

      <BillingCard team={team} />

      <SettingsCard team={team} onDone={() => router.refresh()} />

      <TransferAndCancelCard team={team} members={members} onDone={() => router.refresh()} />
    </div>
  );
}

function InviteSection({
  seatsFull,
  onDone,
}: {
  seatsFull: boolean;
  onDone: () => void;
}) {
  const [emailsText, setEmailsText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    const emails = emailsText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      toast.error("Vul minstens één e-mailadres in.");
      return;
    }
    startTransition(async () => {
      const result = await inviteTeamMembers(emails);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const failed = result.results.filter((r) => r.error);
      const succeeded = result.results.filter((r) => !r.error);
      if (succeeded.length > 0) {
        toast.success(`${succeeded.length} uitnodiging(en) verstuurd.`);
        setEmailsText("");
      }
      failed.forEach((f) => toast.error(`${f.email}: ${f.error}`));
      onDone();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Collega&apos;s uitnodigen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {seatsFull ? (
          <p className="text-sm text-destructive">
            Alle seats zijn in gebruik of gereserveerd via openstaande uitnodigingen. Upgrade je
            pakket hieronder om meer collega&apos;s uit te nodigen.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="invite-emails">E-mailadres(sen)</Label>
              <Textarea
                id="invite-emails"
                value={emailsText}
                onChange={(event) => setEmailsText(event.target.value)}
                placeholder="collega1@school.nl, collega2@school.nl"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Meerdere adressen: gescheiden door een komma of nieuwe regel.</p>
            </div>
            <Button type="button" disabled={isPending} onClick={handleInvite}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Uitnodigen
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PendingInvitesCard({ invites, onDone }: { invites: TeamInvite[]; onDone: () => void }) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleResend(id: string) {
    setPendingId(id);
    resendTeamInvite(id)
      .then((result) => {
        if ("error" in result) toast.error(result.error);
        else toast.success("Uitnodiging opnieuw verstuurd.");
        onDone();
      })
      .finally(() => setPendingId(null));
  }

  function handleRevoke(id: string) {
    if (!window.confirm("Deze uitnodiging intrekken?")) return;
    setPendingId(id);
    revokeTeamInvite(id)
      .then((result) => {
        if ("error" in result) toast.error(result.error);
        else toast.success("Uitnodiging ingetrokken.");
        onDone();
      })
      .finally(() => setPendingId(null));
  }

  function handleCopyLink(token: string) {
    const url = `${window.location.origin}/team/uitnodiging/${token}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link gekopieerd."))
      .catch(() => toast.error("Kopiëren is mislukt — kopieer de link handmatig."));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Openstaande uitnodigingen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
          >
            <div>
              <p className="font-medium">{invite.email}</p>
              <p className="text-xs text-muted-foreground">Verloopt {formatDate(invite.expires_at)}</p>
            </div>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingId === invite.id}
                onClick={() => handleCopyLink(invite.token)}
              >
                <Copy className="size-3.5" />
                Link
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingId === invite.id}
                onClick={() => handleResend(invite.id)}
              >
                Opnieuw sturen
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingId === invite.id}
                onClick={() => handleRevoke(invite.id)}
              >
                <X className="size-3.5" />
                Intrekken
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MembersCard({ members, onDone }: { members: TeamMember[]; onDone: () => void }) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleRemove(member: TeamMember) {
    if (member.role === "owner") return;
    if (!window.confirm(`${member.first_name} ${member.last_name} verwijderen uit het team?`)) return;
    setPendingId(member.id);
    removeTeamMember(member.id)
      .then((result) => {
        if ("error" in result) toast.error(result.error);
        else toast.success("Lid verwijderd — de seat is direct weer beschikbaar.");
        onDone();
      })
      .finally(() => setPendingId(null));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Teamleden ({members.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
            <div>
              <p className="font-medium">
                {member.first_name} {member.last_name}
              </p>
              {member.role === "owner" && (
                <Badge variant="outline" className="mt-0.5">
                  Eigenaar
                </Badge>
              )}
            </div>
            {member.role !== "owner" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingId === member.id}
                onClick={() => handleRemove(member)}
              >
                <Trash2 className="size-3.5" />
                Verwijderen
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BillingCard({ team }: { team: Team }) {
  const [isPortalPending, setIsPortalPending] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<TeamPlan | null>(null);

  async function handlePortal() {
    setIsPortalPending(true);
    try {
      const response = await fetch("/api/stripe/create-team-portal", { method: "POST" });
      const result = await response.json();
      if (!response.ok || "error" in result) {
        toast.error(result.error ?? "Facturatieportaal openen is mislukt.");
        return;
      }
      await openInSystemBrowser(result.url);
    } catch {
      toast.error("Facturatieportaal openen is mislukt.");
    } finally {
      setIsPortalPending(false);
    }
  }

  const availableUpgrades = TEAM_PLAN_ORDER.filter((plan) => plan !== team.plan);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Facturatie &amp; pakket</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" variant="outline" disabled={isPortalPending} onClick={handlePortal}>
          {isPortalPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Facturen &amp; betaalgegevens beheren
        </Button>

        <div className="flex flex-wrap gap-2">
          {availableUpgrades.map((plan) => (
            <Button key={plan} type="button" variant="outline" size="sm" onClick={() => setUpgradeTarget(plan)}>
              Wijzig naar {TEAM_PLANS[plan].label}
            </Button>
          ))}
        </div>

        {upgradeTarget && (
          <PlanChangeConfirm plan={upgradeTarget} onClose={() => setUpgradeTarget(null)} />
        )}
      </CardContent>
    </Card>
  );
}

function PlanChangeConfirm({ plan, onClose }: { plan: TeamPlan; onClose: () => void }) {
  const router = useRouter();
  const [amountDue, setAmountDue] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("eur");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    fetch("/api/stripe/team-plan-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, action: "preview" }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.error) {
          setErrorMessage(result.error);
        } else {
          setAmountDue(result.amountDue);
          setCurrency(result.currency);
        }
      })
      .catch(() => setErrorMessage("Kon het bedrag niet ophalen."))
      .finally(() => setIsLoading(false));
  }, [plan]);

  function handleConfirm() {
    setIsConfirming(true);
    fetch("/api/stripe/team-plan-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, action: "confirm" }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`Pakket gewijzigd naar ${TEAM_PLANS[plan].label}. Er is een factuur verstuurd.`);
        onClose();
        router.refresh();
      })
      .catch(() => toast.error("Pakketwijziging is mislukt."))
      .finally(() => setIsConfirming(false));
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Bevestig wijziging naar {TEAM_PLANS[plan].label}</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Bedrag berekenen...</p>
      ) : errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Te verrekenen bedrag op de nieuwe factuur:{" "}
          <span className="font-semibold text-foreground">
            {((amountDue ?? 0) / 100).toLocaleString("nl-NL", { style: "currency", currency })}
          </span>
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isLoading || Boolean(errorMessage) || isConfirming}
          onClick={handleConfirm}
        >
          {isConfirming ? <Loader2 className="size-4 animate-spin" /> : null}
          Bevestigen
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}

function SettingsCard({ team, onDone }: { team: Team; onDone: () => void }) {
  const [name, setName] = useState(team.name);
  const [domain, setDomain] = useState(team.allowed_email_domain ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateTeamSettings({ name, allowedEmailDomain: domain || null });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Instellingen opgeslagen.");
      onDone();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Teaminstellingen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Teamnaam</Label>
          <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-domain">Toegestaan e-maildomein (optioneel)</Label>
          <Input
            id="settings-domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="schoolnaam.nl"
          />
          <p className="text-xs text-muted-foreground">
            Zet dit om uitnodigingen/acceptaties te beperken tot dit domein. Leeg = geen beperking.
          </p>
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Opslaan
        </Button>
      </CardContent>
    </Card>
  );
}

function TransferAndCancelCard({
  team,
  members,
  onDone,
}: {
  team: Team;
  members: TeamMember[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [transferTarget, setTransferTarget] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const otherMembers = members.filter((m) => m.role !== "owner");

  function handleTransfer() {
    if (!transferTarget) return;
    const target = otherMembers.find((m) => m.user_id === transferTarget);
    if (!target) return;
    if (
      !window.confirm(
        `Eigenaarschap overdragen aan ${target.first_name} ${target.last_name}? Je wordt zelf gewoon lid.`,
      )
    ) {
      return;
    }
    setIsTransferring(true);
    transferTeamOwnership(transferTarget)
      .then((result) => {
        if ("error" in result) toast.error(result.error);
        else {
          toast.success("Eigenaarschap overgedragen.");
          onDone();
        }
      })
      .finally(() => setIsTransferring(false));
  }

  function handleCancel() {
    if (
      !window.confirm(
        `Team "${team.name}" opzeggen? Alle leden verliezen direct hun teamtoegang en vallen terug op hun eigen gratis-via-bijdrage-status — hun eigen activiteiten en opgeslagen items blijven behouden. Dit kan niet ongedaan gemaakt worden.`,
      )
    ) {
      return;
    }
    setIsCanceling(true);
    cancelTeam()
      .then((result) => {
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Team opgezegd.");
        router.refresh();
      })
      .finally(() => setIsCanceling(false));
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base">Eigenaarschap &amp; opzeggen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {otherMembers.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="transfer-target">Eigenaarschap overdragen aan</Label>
            <div className="flex flex-wrap gap-2">
              <select
                id="transfer-target"
                value={transferTarget}
                onChange={(event) => setTransferTarget(event.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Kies een lid...</option>
                {otherMembers.map((member) => (
                  <option key={member.id} value={member.user_id}>
                    {member.first_name} {member.last_name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!transferTarget || isTransferring}
                onClick={handleTransfer}
              >
                {isTransferring ? <Loader2 className="size-4 animate-spin" /> : null}
                Overdragen
              </Button>
            </div>
          </div>
        )}

        <Button type="button" variant="destructive" size="sm" disabled={isCanceling} onClick={handleCancel}>
          {isCanceling ? <Loader2 className="size-4 animate-spin" /> : null}
          Team opzeggen
        </Button>
      </CardContent>
    </Card>
  );
}
