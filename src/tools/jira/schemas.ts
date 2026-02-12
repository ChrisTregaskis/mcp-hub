// Placeholder Zod schemas for Jira API response validation
import { z } from 'zod';

export const JiraIssueResponseSchema = z.object({
  key: z.string(),
  fields: z.object({
    summary: z.string(),
    status: z.object({
      name: z.string(),
    }),
    assignee: z
      .object({
        displayName: z.string(),
      })
      .nullable(),
  }),
});

export type JiraIssueResponse = z.infer<typeof JiraIssueResponseSchema>;
