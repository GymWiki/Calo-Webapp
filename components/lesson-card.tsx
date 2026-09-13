import Link from "next/link";
import { Eye } from "lucide-react";

import { ShareLessonButton } from "@/components/ShareLessonButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Activity } from "@/types/activity";

export function LessonCard({
  activity,
  currentUserId,
}: {
  activity: Activity;
  currentUserId?: string;
}) {
  const date = formatDate(activity.activity_date);

  return (
    <Card className="transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md">
      <CardHeader>
        <CardTitle>{activity.titel}</CardTitle>
        {date && <p className="text-sm text-muted-foreground">{date}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {activity.group_name && (
            <Badge variant="secondary">{activity.group_name}</Badge>
          )}
          {activity.leerlijn && (
            <Badge variant="outline">{activity.leerlijn}</Badge>
          )}
        </div>
        <dl className="space-y-1 text-sm">
          {activity.movement_problem && (
            <div>
              <dt className="font-medium text-foreground">Bewegingsprobleem</dt>
              <dd className="text-muted-foreground">{activity.movement_problem}</dd>
            </div>
          )}
          {activity.beweegthema && (
            <div>
              <dt className="font-medium text-foreground">Bewegingsthema</dt>
              <dd className="text-muted-foreground">{activity.beweegthema}</dd>
            </div>
          )}
        </dl>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/activiteit/${activity.id}`}>
            <Eye className="size-4" />
            Bekijken / PDF
          </Link>
        </Button>
        <ShareLessonButton
          lessonId={activity.id}
          lessonTitle={activity.titel}
          isOwner={activity.author_id === currentUserId}
          initialIsPublic={activity.is_public}
          isAiGenerated={activity.is_ai_generated}
          className="flex-1"
        />
      </CardFooter>
    </Card>
  );
}
