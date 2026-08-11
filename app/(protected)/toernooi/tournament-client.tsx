"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ClipboardCopy, Minus, Plus, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { saveTournament } from "@/actions/tournament";
import { TournamentPdfButton } from "@/components/TournamentPdfButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildWhiteboardText,
  computeStandings,
  generateSchedule,
  getMatchStatus,
  resolveTeamRef,
  validateTournamentSettings,
} from "@/lib/utils/tournamentGenerator";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TOURNAMENT_SETTINGS,
  TOURNAMENT_FORMAT_DESCRIPTIONS,
  TOURNAMENT_FORMAT_LABELS,
  type Match,
  type MatchStatus,
  type ScheduleSlot,
  type TeamStanding,
  type TournamentFormat,
  type TournamentSchedule,
  type TournamentScores,
  type TournamentSettings,
} from "@/types/tournament";

function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  function clamp(next: number) {
    return Math.min(max, Math.max(min, next));
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(clamp(value - 1))}
          aria-label={`${label} verlagen`}
        >
          <Minus className="size-4" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (!Number.isNaN(parsed)) onChange(clamp(parsed));
          }}
          className="w-16 text-center"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(clamp(value + 1))}
          aria-label={`${label} verhogen`}
        >
          <Plus className="size-4" />
        </Button>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function FormatOption({
  format,
  current,
  onSelect,
}: {
  format: TournamentFormat;
  current: TournamentFormat;
  onSelect: (format: TournamentFormat) => void;
}) {
  const active = current === format;
  return (
    <button
      type="button"
      onClick={() => onSelect(format)}
      aria-pressed={active}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors duration-150 ease-brand",
        active ? "border-primary bg-primary/5" : "border-input hover:bg-accent",
      )}
    >
      <p className="text-sm font-medium">{TOURNAMENT_FORMAT_LABELS[format]}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {TOURNAMENT_FORMAT_DESCRIPTIONS[format]}
      </p>
    </button>
  );
}

function SettingsForm({
  settings,
  onChange,
  onGenerate,
}: {
  settings: TournamentSettings;
  onChange: (settings: TournamentSettings) => void;
  onGenerate: () => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function update<K extends keyof TournamentSettings>(
    key: K,
    value: TournamentSettings[K],
  ) {
    onChange({ ...settings, [key]: value });
  }

  function updateTeamName(index: number, value: string) {
    const names = [...settings.teamNames];
    names[index] = value;
    update("teamNames", names);
  }

  function updateFieldName(index: number, value: string) {
    const names = [...settings.fieldNames];
    names[index] = value;
    update("fieldNames", names);
  }

  return (
    <Card className="animate-fade-up">
      <CardHeader>
        <CardTitle>Toernooi instellingen</CardTitle>
        <CardDescription>
          Stel je toernooi in — je kunt dit later altijd aanpassen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberStepper
            label="Aantal teams / groepen"
            value={settings.teamCount}
            min={3}
            max={32}
            onChange={(value) => update("teamCount", value)}
          />
          <NumberStepper
            label="Aantal beschikbare velden"
            value={settings.fieldCount}
            min={1}
            max={12}
            onChange={(value) => update("fieldCount", value)}
          />
        </div>

        <div>
          <Label>Toernooivorm</Label>
          <div className="mt-1.5 flex flex-col gap-2">
            {(Object.keys(TOURNAMENT_FORMAT_LABELS) as TournamentFormat[]).map(
              (format) => (
                <FormatOption
                  key={format}
                  format={format}
                  current={settings.format}
                  onSelect={(value) => update("format", value)}
                />
              ),
            )}
          </div>
        </div>

        <NumberStepper
          label="Wedstrijdduur"
          value={settings.matchDurationMinutes}
          min={1}
          max={60}
          suffix="minuten"
          onChange={(value) => update("matchDurationMinutes", value)}
        />

        <Collapsible
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          className="rounded-lg border p-4"
        >
          <CollapsibleTrigger className="min-h-11 text-sm font-semibold">
            Geavanceerde opties
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-5">
            <NumberStepper
              label="Rust/pauzetijd tussen wedstrijden"
              value={settings.breakDurationMinutes}
              min={0}
              max={30}
              suffix="minuten"
              onChange={(value) => update("breakDurationMinutes", value)}
            />

            <div>
              <Label htmlFor="tournament-start-time">Starttijd</Label>
              <Input
                id="tournament-start-time"
                type="time"
                value={settings.startTime}
                onChange={(event) => update("startTime", event.target.value)}
                className="mt-1.5 w-32"
              />
            </div>

            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input
                type="checkbox"
                checked={settings.autoAssignReferees}
                onChange={(event) =>
                  update("autoAssignReferees", event.target.checked)
                }
                disabled={settings.format === "knockout"}
                className="mt-0.5 size-5 shrink-0 accent-primary disabled:opacity-50"
              />
              <span className="text-sm">
                <span className="block font-medium">
                  Automatisch rustende teams toewijzen als scheidsrechter
                </span>
                <span className="block text-muted-foreground">
                  {settings.format === "knockout"
                    ? "Niet beschikbaar bij knock-out — er zijn geen vaste rustende teams."
                    : "Een team dat een ronde rust, fluit automatisch een wedstrijd in die ronde."}
                </span>
              </span>
            </label>

            <div className="space-y-3">
              <Label>Aangepaste teamnamen</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Array.from({ length: settings.teamCount }, (_, index) => (
                  <Input
                    key={index}
                    value={settings.teamNames[index] ?? ""}
                    onChange={(event) => updateTeamName(index, event.target.value)}
                    placeholder={`Team ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Veldnamen</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Array.from({ length: settings.fieldCount }, (_, index) => (
                  <Input
                    key={index}
                    value={settings.fieldNames[index] ?? ""}
                    onChange={(event) => updateFieldName(index, event.target.value)}
                    placeholder={`Veld ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button type="button" size="lg" className="w-full" onClick={onGenerate}>
          <Sparkles className="size-4" />
          Genereer speelschema
        </Button>
      </CardContent>
    </Card>
  );
}

function MatchStatusBadge({ status }: { status: MatchStatus }) {
  if (status === "done") {
    return <Badge variant="success">Afgerond</Badge>;
  }
  if (status === "live") {
    return <Badge className="animate-pulse">Bezig</Badge>;
  }
  return <Badge variant="outline">Aankomend</Badge>;
}

function MatchRow({
  slot,
  match,
  schedule,
  scores,
  refereeId,
  onScoreChange,
}: {
  slot: ScheduleSlot;
  match: Match;
  schedule: TournamentSchedule;
  scores: TournamentScores;
  refereeId: string | undefined;
  onScoreChange: (matchId: string, side: "home" | "away", value: string) => void;
}) {
  const home = resolveTeamRef(match.home, schedule, scores);
  const away = resolveTeamRef(match.away, schedule, scores);
  const fieldName =
    schedule.fields.find((field) => field.index === match.fieldIndex)?.name ??
    `Veld ${match.fieldIndex + 1}`;
  const refereeName = refereeId
    ? schedule.teams.find((team) => team.id === refereeId)?.name
    : null;
  const score = scores[match.id];
  const canScore = home.decided && away.decided;
  const status = getMatchStatus(slot, match, scores);

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {fieldName}
          {refereeName ? ` · Scheidsrechter: ${refereeName}` : ""}
        </p>
        <MatchStatusBadge status={status} />
      </div>
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        <span className="min-w-0 flex-1 truncate">{home.name}</span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">vs</span>
        <span className="min-w-0 flex-1 truncate text-right">{away.name}</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={score?.homeScore ?? ""}
          onChange={(event) => onScoreChange(match.id, "home", event.target.value)}
          disabled={!canScore}
          placeholder="0"
          className="h-14 w-16 text-center text-lg font-semibold"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={score?.awayScore ?? ""}
          onChange={(event) => onScoreChange(match.id, "away", event.target.value)}
          disabled={!canScore}
          placeholder="0"
          className="h-14 w-16 text-center text-lg font-semibold"
        />
      </div>
    </div>
  );
}

function RoundCard({
  slot,
  schedule,
  scores,
  onScoreChange,
}: {
  slot: ScheduleSlot;
  schedule: TournamentSchedule;
  scores: TournamentScores;
  onScoreChange: (matchId: string, side: "home" | "away", value: string) => void;
}) {
  const restingNames = slot.restingTeamIds
    .map((id) => schedule.teams.find((team) => team.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <Card className="animate-fade-up">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Ronde {slot.round}</CardTitle>
          <Badge variant="secondary">
            {slot.startTime} - {slot.endTime}
          </Badge>
        </div>
        {restingNames.length > 0 && (
          <CardDescription>Rust: {restingNames.join(", ")}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {slot.matches.map((match) => (
          <MatchRow
            key={match.id}
            slot={slot}
            match={match}
            schedule={schedule}
            scores={scores}
            refereeId={slot.refereeAssignments[match.id]}
            onScoreChange={onScoreChange}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function WhiteboardRoundBlock({
  slot,
  schedule,
  scores,
}: {
  slot: ScheduleSlot;
  schedule: TournamentSchedule;
  scores: TournamentScores;
}) {
  const restingNames = slot.restingTeamIds
    .map((id) => schedule.teams.find((team) => team.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Ronde {slot.round}</p>
        <Badge variant="secondary">
          {slot.startTime} - {slot.endTime}
        </Badge>
      </div>
      <div className="space-y-1.5 font-mono text-sm break-words">
        {slot.matches.map((match) => {
          const home = resolveTeamRef(match.home, schedule, scores);
          const away = resolveTeamRef(match.away, schedule, scores);
          const fieldName =
            schedule.fields.find((field) => field.index === match.fieldIndex)
              ?.name ?? `Veld ${match.fieldIndex + 1}`;

          return (
            <p key={match.id}>
              <span className="text-muted-foreground">[{fieldName}]:</span>{" "}
              {home.name} vs {away.name}
            </p>
          );
        })}
        {restingNames.length > 0 && (
          <p className="text-muted-foreground">
            [Rust / Scheidsrechter]: {restingNames.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

function StandingsTable({ standings }: { standings: TeamStanding[] }) {
  return (
    <Card className="animate-fade-up">
      <CardHeader>
        <CardTitle>Stand</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground uppercase">
              <th className="py-2 pr-2">Team</th>
              <th className="px-2 text-center">Sp</th>
              <th className="px-2 text-center">W</th>
              <th className="px-2 text-center">G</th>
              <th className="px-2 text-center">V</th>
              <th className="px-2 text-center">DS</th>
              <th className="pl-2 text-center">Pt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => (
              <tr key={standing.teamId} className="border-b last:border-0">
                <td className="py-2 pr-2 font-medium">{standing.teamName}</td>
                <td className="px-2 text-center">{standing.played}</td>
                <td className="px-2 text-center">{standing.won}</td>
                <td className="px-2 text-center">{standing.drawn}</td>
                <td className="px-2 text-center">{standing.lost}</td>
                <td className="px-2 text-center">{standing.goalDifference}</td>
                <td className="pl-2 text-center font-semibold">{standing.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function TournamentClient() {
  const [settings, setSettings] = useState<TournamentSettings>(
    DEFAULT_TOURNAMENT_SETTINGS,
  );
  const [schedule, setSchedule] = useState<TournamentSchedule | null>(null);
  const [scores, setScores] = useState<TournamentScores>({});
  const [title, setTitle] = useState("");
  const [isSaving, startSaving] = useTransition();

  function handleGenerate() {
    const error = validateTournamentSettings(settings);
    if (error) {
      toast.error(error);
      return;
    }

    const generated = generateSchedule(settings);
    setSchedule(generated);
    setScores({});
    if (!title.trim()) {
      setTitle(`Toernooi ${new Date().toLocaleDateString("nl-NL")}`);
    }
  }

  function handleScoreChange(
    matchId: string,
    side: "home" | "away",
    value: string,
  ) {
    const parsed = value === "" ? 0 : Number(value);
    if (Number.isNaN(parsed)) return;

    setScores((prev) => {
      const existing = prev[matchId] ?? { homeScore: 0, awayScore: 0 };
      return {
        ...prev,
        [matchId]: {
          ...existing,
          [side === "home" ? "homeScore" : "awayScore"]: Math.max(0, parsed),
        },
      };
    });
  }

  function handleSave() {
    if (!schedule) return;

    startSaving(async () => {
      const result = await saveTournament({ title, settings, schedule, scores });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Toernooi opgeslagen in je profiel.");
    });
  }

  async function handleCopyText() {
    if (!schedule) return;

    const text = buildWhiteboardText(schedule, scores, title || "Toernooi");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Schema gekopieerd naar klembord.");
    } catch {
      toast.error("Kopiëren is mislukt. Probeer het opnieuw.");
    }
  }

  if (!schedule) {
    return (
      <SettingsForm
        settings={settings}
        onChange={setSettings}
        onGenerate={handleGenerate}
      />
    );
  }

  const standings =
    schedule.format !== "knockout" ? computeStandings(schedule, scores) : null;

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => setSchedule(null)}>
          <ArrowLeft className="size-4" />
          Instellingen aanpassen
        </Button>
        <div className="hidden gap-2 md:flex">
          <TournamentPdfButton
            schedule={schedule}
            scores={scores}
            title={title || "Toernooi"}
          />
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            <Save className="size-4" />
            {isSaving ? "Opslaan..." : "Opslaan in mijn profiel"}
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="tournament-title">Naam van het toernooi</Label>
        <Input
          id="tournament-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="bijv. Sportdag groep 7-8"
          className="mt-1.5"
        />
      </div>

      <Tabs defaultValue="whiteboard" className="gap-4">
        <TabsList className="sticky top-0 z-30 h-auto w-full gap-1 border bg-background/95 p-1 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
          <TabsTrigger value="whiteboard" className="min-h-11 flex-1 text-sm">
            📋 Whiteboard View
          </TabsTrigger>
          <TabsTrigger value="scoring" className="min-h-11 flex-1 text-sm">
            🏆 Live Scoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whiteboard" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleCopyText}>
              <ClipboardCopy className="size-4" />
              Kopieer als tekst
            </Button>
            <TournamentPdfButton
              schedule={schedule}
              scores={scores}
              title={title || "Toernooi"}
            />
          </div>
          {schedule.slots.map((slot) => (
            <WhiteboardRoundBlock
              key={slot.round}
              slot={slot}
              schedule={schedule}
              scores={scores}
            />
          ))}
        </TabsContent>

        <TabsContent value="scoring" className="space-y-4">
          {schedule.slots.map((slot) => (
            <RoundCard
              key={slot.round}
              slot={slot}
              schedule={schedule}
              scores={scores}
              onScoreChange={handleScoreChange}
            />
          ))}
          {standings && <StandingsTable standings={standings} />}
        </TabsContent>
      </Tabs>

      <div className="fixed inset-x-0 bottom-16 z-40 flex gap-2 border-t bg-card p-4 shadow-brand-lg md:hidden">
        <TournamentPdfButton
          schedule={schedule}
          scores={scores}
          title={title || "Toernooi"}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1"
        >
          <Save className="size-4" />
          {isSaving ? "Opslaan..." : "Opslaan"}
        </Button>
      </div>
    </div>
  );
}
