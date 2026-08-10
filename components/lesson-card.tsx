import Link from "next/link";
import { Eye } from "lucide-react";

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

export function LessonCard({ lesson }: { lesson: Lesson }) {
  const date = formatDate(lesson.lesson_date);

  return (
    <Card>
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
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/les/${lesson.id}`}>
            <Eye className="size-4" />
            Bekijken / PDF
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
