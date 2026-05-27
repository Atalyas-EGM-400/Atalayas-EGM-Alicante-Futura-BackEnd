export type ActivityType =
  | 'CONTENT_COMPLETED'
  | 'COURSE_ENROLLED'
  | 'DOCUMENT_ADDED'
  | 'ANNOUNCEMENT'
  | 'EVENT_ADDED'
  | 'TASK_COMPLETED';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  icon: string;
  createdAt: Date;
  href?: string;
}
