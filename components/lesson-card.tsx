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
import type { Lesson } from "@/types/lesson";

export function LessonCard({
  lesson,
  currentUserId,
}: {
  lesson: Lesson;
  currentUserId?: string;
}) {
  const date = formatDate(lesson.lesson_date);

  return (
    <Card className="transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md">
      <CardHeader>
        <CardTitle>{lesson.title}</CardTitle>
        {date && <p className="text-sm text-muted-foreground">{date}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {lesson.group_name && (
            <Badge variant="secondary">{lesson.group_name}</Badge>
          )}
          {lesson.learning_line && (
            <Badge variant="outline">{lesson.learning_line}</Badge>
          )}
        </div>
        <dl className="space-y-1 text-sm">
          {lesson.movement_problem && (
            <div>
              <dt className="font-medium text-foreground">Bewegingsprobleem</dt>
              <dd className="text-muted-foreground">{lesson.movement_problem}</dd>
            </div>
          )}
          {lesson.movement_theme && (
            <div>
              <dt className="font-medium text-foreground">Bewegingsthema</dt>
              <dd className="text-muted-foreground">{lesson.movement_theme}</dd>
            </div>
          )}
        </dl>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/les/${lesson.id}`}>
            <Eye className="size-4" />
            Bekijken / PDF
          </Link>
        </Button>
        <ShareLessonButton
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          isOwner={lesson.author_id === currentUserId}
          initialIsPublic={lesson.is_public}
          className="flex-1"
        />
      </CardFooter>
    </Card>
  );
}
